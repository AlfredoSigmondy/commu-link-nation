import { useState, useEffect, FormEvent } from 'react';
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

interface LoginFormData {
  email: string;
  password: string;
}

interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  contactNumber: string;
  streetAddress: string;
  barangayName: string;
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

  // Add form state for controlled inputs
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    email: '',
    password: ''
  });

  const [signupForm, setSignupForm] = useState<SignupFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    contactNumber: '',
    streetAddress: '',
    barangayName: ''
  });

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

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Use state values instead of FormData
    const { email, password } = loginForm;

    if (!email.trim() || !password.trim()) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please fill in all required fields', 
        variant: 'destructive' 
      });
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ 
      email: email.trim(), 
      password: password.trim() 
    });

    if (error) {
      toast({ 
        title: 'Login failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } else {
      navigate('/dashboard');
    }

    setIsLoading(false);
  };

  const handleSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    // Use state values instead of FormData
    const { 
      email, 
      password, 
      confirmPassword, 
      fullName, 
      contactNumber, 
      streetAddress, 
      barangayName 
    } = signupForm;

    // Validate required fields
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !fullName.trim() || !streetAddress.trim() || !barangayName.trim() || !selectedCityCode) {
      toast({ 
        title: 'Validation Error', 
        description: 'Please fill in all required fields', 
        variant: 'destructive' 
      });
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast({ 
        title: "Passwords don't match", 
        variant: 'destructive' 
      });
      setIsLoading(false);
      return;
    }

    const cityItem = citiesMunicipalities.find((i) => i.code === selectedCityCode);
    const finalAddress = `${streetAddress.trim()}, ${barangayName.trim()}, ${cityItem?.name ?? ''}`;

    const { data: signupData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: { 
        data: { 
          full_name: fullName.trim(), 
          contact_number: contactNumber.trim(), 
          address: finalAddress 
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      toast({ 
        title: 'Sign up failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } else if (signupData.user?.identities?.length === 0) {
      toast({ 
        title: 'Account already exists', 
        description: 'Please log in instead.', 
        variant: 'destructive' 
      });
    } else {
      toast({ 
        title: 'Check your email!', 
        description: 'A verification link has been sent to your email address.' 
      });
      
      // Clear form after successful submission
      setSignupForm({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        contactNumber: '',
        streetAddress: '',
        barangayName: ''
      });
      setQuery('');
      setSelectedCityCode('');
      setSelectedCityType('');
      setBarangays([]);
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    const email = loginForm.email.trim();
    
    if (!email) {
      toast({ 
        title: 'Email required', 
        description: 'Please enter your email address', 
        variant: 'destructive' 
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ 
        title: 'Error', 
        description: error.message, 
        variant: 'destructive' 
      });
    } else {
      toast({ 
        title: 'Check your email!', 
        description: 'Password reset link sent.' 
      });
    }

    setIsLoading(false);
  };

  // Handle input changes
  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSignupChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSignupForm(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 relative">
      {/* Search Modal */}
      {searchModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white w-80 rounded-xl p-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 mb-3">
              <Search size={18} />
              <Input 
                placeholder="Search city or municipality..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                autoFocus
              />
              <Button variant="ghost" onClick={() => setSearchModal(false)}>
                <X />
              </Button>
            </div>

            <div className="max-h-64 overflow-auto space-y-1">
              {filtered.map((loc) => (
                <div 
                  key={loc.code} 
                  onClick={() => selectLocality(loc)} 
                  className="p-2 border rounded-lg cursor-pointer hover:bg-gray-100 text-sm"
                >
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
          <CardTitle className="text-2xl text-center bg-gradient-hero bg-clip-text text-transparent">
            Community Match
          </CardTitle>
          <CardDescription className="text-center">
            Create an account or log in
          </CardDescription>
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
                  <Label htmlFor="login-email">Email</Label>
                  <Input 
                    id="login-email" 
                    name="email" 
                    type="email" 
                    value={loginForm.email}
                    onChange={handleLoginChange}
                    required 
                    disabled={isLoading}
                    placeholder="Enter your email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="login-password"
                      name="password" 
                      type={showPassword.login ? 'text' : 'password'} 
                      value={loginForm.password}
                      onChange={handleLoginChange}
                      required 
                      disabled={isLoading}
                      placeholder="Enter your password"
                    />
                    <button 
                      type="button" 
                      className="absolute right-3 top-1/2 -translate-y-1/2" 
                      onClick={() => setShowPassword({ ...showPassword, login: !showPassword.login })}
                      disabled={isLoading}
                    >
                      {showPassword.login ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                
                <Button 
                  type="button" 
                  variant="link" 
                  onClick={handleForgotPassword} 
                  disabled={isLoading}
                  className="p-0 h-auto"
                >
                  Forgot password?
                </Button>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Log In'}
                </Button>
              </form>
            </TabsContent>

            {/* SIGNUP */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName"
                    name="fullName" 
                    value={signupForm.fullName}
                    onChange={handleSignupChange}
                    required 
                    disabled={isLoading}
                    placeholder="Enter your full name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input 
                    id="signup-email"
                    name="email" 
                    type="email" 
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    required 
                    disabled={isLoading}
                    placeholder="Enter your email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input 
                      id="password"
                      name="password" 
                      type={showPassword.signup ? 'text' : 'password'} 
                      value={signupForm.password}
                      onChange={handleSignupChange}
                      required 
                      disabled={isLoading}
                      placeholder="Create a password"
                    />
                    <button 
                      type="button" 
                      className="absolute right-3 top-1/2 -translate-y-1/2" 
                      onClick={() => setShowPassword({ ...showPassword, signup: !showPassword.signup })}
                      disabled={isLoading}
                    >
                      {showPassword.signup ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword"
                      name="confirmPassword" 
                      type={showPassword.confirm ? 'text' : 'password'} 
                      value={signupForm.confirmPassword}
                      onChange={handleSignupChange}
                      required 
                      disabled={isLoading}
                      placeholder="Confirm your password"
                    />
                    <button 
                      type="button" 
                      className="absolute right-3 top-1/2 -translate-y-1/2" 
                      onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                      disabled={isLoading}
                    >
                      {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number (optional)</Label>
                  <Input 
                    id="contactNumber"
                    name="contactNumber" 
                    value={signupForm.contactNumber}
                    onChange={handleSignupChange}
                    disabled={isLoading}
                    placeholder="Enter your contact number"
                  />
                </div>

                {/* City/Municipality Search */}
                <div className="space-y-2">
                  <Label htmlFor="city-search">City / Municipality</Label>
                  <div className="relative">
                    <Input 
                      id="city-search"
                      value={query} 
                      placeholder="Search city or municipality..." 
                      onClick={() => setSearchModal(true)} 
                      readOnly 
                      className="cursor-pointer bg-white"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Barangay */}
                <div className="space-y-2">
                  <Label htmlFor="barangayName">Barangay</Label>
                  <select 
                    id="barangayName"
                    name="barangayName" 
                    value={signupForm.barangayName}
                    onChange={handleSignupChange}
                    className="flex h-10 w-full border px-3 rounded-md bg-white" 
                    disabled={!selectedCityCode || isLoading}
                    required
                  >
                    <option value="">
                      {selectedCityCode ? 'Select barangay' : 'Choose city first'}
                    </option>
                    {barangays.map((b) => (
                      <option key={b.code} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="streetAddress">Street / House No.</Label>
                  <Input 
                    id="streetAddress"
                    name="streetAddress" 
                    value={signupForm.streetAddress}
                    onChange={handleSignupChange}
                    required 
                    disabled={isLoading}
                    placeholder="Enter your street address"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || !selectedCityCode}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;