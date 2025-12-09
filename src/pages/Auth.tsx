// Enhanced Auth Component with Improved City/Municipality Search Modal
// By ChatGPT — Fully Integrated

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Eye, EyeOff, Search, X } from 'lucide-react';

interface Locality {
  code: string;
  name: string;
  type: 'city' | 'municipality';
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({ login: false, signup: false, confirm: false });

  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [citiesMunicipalities, setCitiesMunicipalities] = useState<Locality[]>([]);
  const [selectedCityCode, setSelectedCityCode] = useState('');
  const [selectedCityType, setSelectedCityType] = useState<'city' | 'municipality' | ''>('');

  const [barangays, setBarangays] = useState<Locality[]>([]);
  const [isLocalityLoading, setIsLocalityLoading] = useState(false);

  const [searchModal, setSearchModal] = useState(false);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState<Locality[]>([]);

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  useEffect(() => {
    const fetchLocalities = async () => {
      setIsLocalityLoading(true);
      try {
        const [citiesRes, munisRes] = await Promise.all([
          fetch('https://psgc.cloud/api/cities'),
          fetch('https://psgc.cloud/api/municipalities')
        ]);

        const cities = (await citiesRes.json()).map((c: any) => ({ code: c.code, name: c.name, type: 'city' }));
        const municipalities = (await munisRes.json()).map((m: any) => ({ code: m.code, name: m.name, type: 'municipality' }));

        const combined = [...cities, ...municipalities].sort((a, b) => a.name.localeCompare(b.name));

        setCitiesMunicipalities(combined);
      } catch {
        toast({ title: 'Error loading locations', variant: 'destructive' });
      } finally {
        setIsLocalityLoading(false);
      }
    };

    fetchLocalities();
  }, [toast]);

  useEffect(() => {
    if (!query) setFiltered([]);
    else {
      const text = query.toLowerCase();
      setFiltered(
        citiesMunicipalities.filter((item) => item.name.toLowerCase().includes(text))
      );
    }
  }, [query, citiesMunicipalities]);

  useEffect(() => {
    if (!selectedCityCode || !selectedCityType) {
      setBarangays([]);
      return;
    }

    const fetchBarangays = async () => {
      try {
        const endpoint =
          selectedCityType === 'city'
            ? `https://psgc.cloud/api/cities/${selectedCityCode}/barangays`
            : `https://psgc.cloud/api/municipalities/${selectedCityCode}/barangays`;

        const res = await fetch(endpoint);
        const data = await res.json();

        setBarangays(
          data.map((b: any) => ({ code: b.code, name: b.name, type: 'barangay' })).sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch {
        toast({ title: 'Error fetching barangays', variant: 'destructive' });
      }
    };

    fetchBarangays();
  }, [selectedCityCode, selectedCityType, toast]);

  const selectLocality = (loc: Locality) => {
    setSelectedCityCode(loc.code);
    setSelectedCityType(loc.type);
    setQuery(loc.name);
    setSearchModal(false);
  };

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) toast({ title: 'Login failed', description: error.message, variant: 'destructive' });
    else navigate('/dashboard');

    setIsLoading(false);
  };

  const handleSignup = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);

    const data = new FormData(e.currentTarget);

    const email = data.get('email') as string;
    const password = data.get('password') as string;
    const confirmPassword = data.get('confirmPassword') as string;
    const fullName = data.get('fullName') as string;
    const contact = data.get('contactNumber') as string;
    const street = data.get('streetAddress') as string;
    const barangay = data.get('barangayName') as string;

    const cityItem = citiesMunicipalities.find((i) => i.code === selectedCityCode);
    const finalAddress = `${street}, ${barangay}, ${cityItem?.name ?? ''}`;

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const { data: signupData, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, contact_number: contact, address: finalAddress } }
    });

    if (error) toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Verify your email', description: 'A verification link was sent.' });

    setIsLoading(false);
  };
   const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement)?.value?.trim();
    if (!email) return toast({ title: 'Email required', variant: 'destructive' });

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    error
      ? toast({ title: 'Error', description: error.message, variant: 'destructive' })
      : toast({ title: 'Check your email!', description: 'Password reset link sent.' });

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 relative">
      {/* Search Modal */}
      {searchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-80 rounded-xl p-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 mb-3">
              <Search size={18} />
              <Input placeholder="Search city or municipality..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button variant="ghost" onClick={() => setSearchModal(false)}><X /></Button>
            </div>

            <div className="max-h-64 overflow-auto space-y-1">
              {filtered.map((loc) => (
                <div key={loc.code} onClick={() => selectLocality(loc)} className="p-2 border rounded-lg cursor-pointer hover:bg-gray-100 text-sm">
                  {loc.name} <span className="text-xs text-gray-500">({loc.type})</span>
                </div>
              ))}

              {filtered.length === 0 && query && (
                <p className="text-center text-gray-400 text-sm">No results found</p>
              )}
            </div>
          </div>
        </div>
      )}

      <Card className="w-full max-w-md shadow-medium">
        <CardHeader>
          <CardTitle className="text-2xl text-center bg-gradient-hero bg-clip-text text-transparent">Community Match</CardTitle>
          <CardDescription className="text-center">Create an account or log in</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input name="password" type={showPassword.login ? 'text' : 'password'} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword({ ...showPassword, login: !showPassword.login })}>{showPassword.login ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>
                <Button type="button" variant="link" onClick={handleForgotPassword} disabled={isLoading}>
                  Forgot password?
                </Button>

                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Signing in...' : 'Log In'}</Button>
              </form>
            </TabsContent>

            {/* SIGNUP */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2"><Label>Full Name</Label><Input name="fullName" required /></div>
                <div className="space-y-2"><Label>Email</Label><Input name="email" type="email" required /></div>

                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input name="password" type={showPassword.signup ? 'text' : 'password'} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword({ ...showPassword, signup: !showPassword.signup })}>{showPassword.signup ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <div className="relative">
                    <Input name="confirmPassword" type={showPassword.confirm ? 'text' : 'password'} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}>{showPassword.confirm ? <EyeOff /> : <Eye />}</button>
                  </div>
                </div>

                <div className="space-y-2"><Label>Contact Number (optional)</Label><Input name="contactNumber" /></div>

                {/* New Search Input */}
                <div className="space-y-2">
                  <Label>City / Municipality</Label>
                  <div className="relative">
                    <Input value={query} placeholder="Search..." onClick={() => setSearchModal(true)} readOnly className="cursor-pointer bg-white" />
                  </div>
                </div>

                {/* Barangay */}
                <div className="space-y-2">
                  <Label>Barangay</Label>
                  <select name="barangayName" className="flex h-10 w-full border px-3 rounded-md" disabled={!selectedCityCode} required>
                    <option value="">{selectedCityCode ? 'Select barangay' : 'Choose city first'}</option>
                    {barangays.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2"><Label>Street / House No.</Label><Input name="streetAddress" required /></div>

                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Creating account...' : 'Create Account'}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
