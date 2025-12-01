// src/pages/Profile.tsx  (or components/Profile.tsx)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, LogOut, Image as ImageIcon, Users, Zap, Play } from 'lucide-react';
import { SignOutDialog } from '@/components/SignOutDialog';
import { NotificationBell } from '@/components/NotificationBell';

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  const [posts, setPosts] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
    if (user) {
      fetchProfile();
      fetchPosts();
      fetchMedia();
      fetchFriends();
    }
  }, [user, loading]);

  const fetchProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single();
    setProfile(data);
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user?.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };

  const fetchMedia = async () => {
    const { data } = await supabase
      .from('posts')
      .select('image_url, media_type')
      .eq('user_id', user?.id)
      .eq('status', 'approved')
      .not('image_url', 'is', null);

    if (!data) return;
    const items = data.map(item => {
      const { data: { publicUrl } } = supabase.storage.from('posts').getPublicUrl(item.image_url!);
      return { url: publicUrl, type: item.media_type || 'image/jpeg' };
    });
    setMedia(items);
  };

  const fetchFriends = async () => {
    const { data } = await supabase
      .from('friendships')
      .select('friend_id, profiles!friendships_friend_id_fkey(full_name, avatar_url)')
      .eq('user_id', user?.id)
      .eq('status', 'accepted');
    setFriends(data || []);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setAvatarFile(e.target.files[0]);
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !user) return null;
    const ext = avatarFile.name.split('.').pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const updates: any = {
      full_name: form.fullName.value,
      contact_number: form.contactNumber.value || null,
      address: form.address.value || null,
    };
    if (avatarFile) updates.avatar_url = await uploadAvatar();

    const { error } = await supabase.from('profiles').update(updates).eq('id', user?.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Profile updated!" });
      fetchProfile();
      setIsEditing(false);
      setAvatarFile(null);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-[#2ec2b3] rounded-full border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20">
      {/* Header - Same as Friends page */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-teal-50 rounded-xl">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold text-[#2ec2b3]">My Profile</h1>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSignOutDialog(true)}
                className="hover:bg-red-50 rounded-xl"
              >
                <LogOut className="h-5 w-5 text-red-600" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SignOutDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog} />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card className="overflow-hidden border border-[#2ec2b3]/20 bg-white rounded-2xl shadow-lg">
          <div className="h-32 bg-[#2ec2b3]" />

          <div className="relative px-6 pb-8">
            <div className="absolute -top-14 left-6">
              <Avatar className="h-28 w-28 ring-8 ring-white shadow-2xl border-4 border-white">
                <AvatarImage src={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatar_url || ''} />
                <AvatarFallback className="bg-[#2ec2b3] text-white text-3xl font-bold">
                  {profile.full_name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Edit Button - Always visible */}
            <Button
              onClick={() => setIsEditing(!isEditing)}
              className="absolute top-4 right-6 bg-[#2ec2b3] hover:bg-[#28a399] text-white rounded-xl px-5 py-2 font-medium"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>

            <div className="pt-16">
              <h2 className="text-3xl font-bold text-gray-900">{profile.full_name}</h2>
              <p className="text-[#2ec2b3] font-semibold text-lg mt-1">{friends.length} Friends</p>
            </div>

            {/* Edit Form */}
            {isEditing && (
              <form onSubmit={handleSave} className="mt-8 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <Label>Full Name</Label>
                    <Input name="fullName" defaultValue={profile.full_name} required className="h-11" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input name="contactNumber" defaultValue={profile.contact_number || ''} className="h-11" />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input name="address" defaultValue={profile.address || ''} className="h-11" />
                </div>
                <div>
                  <Label>Avatar</Label>
                  <Input type="file" accept="image/*" onChange={handleAvatarChange} />
                </div>
                <Button type="submit" className="w-full bg-[#2ec2b3] hover:bg-[#28a399] h-12 rounded-xl font-bold">
                  <Save className="h-5 w-5 mr-2" /> Save Changes
                </Button>
              </form>
            )}

            {/* Profile Info */}
            {!isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 text-gray-700">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-semibold">{user?.email}</p>
                </div>
                {profile.contact_number && (
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-semibold">{profile.contact_number}</p>
                  </div>
                )}
                {profile.address && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-semibold">{profile.address}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl shadow p-1 mb-6">
            <TabsTrigger value="posts" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
              <Zap className="h-4 w-4 mr-2" /> Posts
            </TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
              <ImageIcon className="h-4 w-4 mr-2" /> Media
            </TabsTrigger>
            <TabsTrigger value="friends" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-lg py-3 font-medium">
              <Users className="h-4 w-4 mr-2" /> Friends
            </TabsTrigger>
          </TabsList>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-5">
            {posts.length === 0 ? (
              <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                <p className="text-gray-500 text-lg">No posts yet</p>
              </Card>
            ) : (
              posts.map(post => {
                const url = post.image_url ? supabase.storage.from('posts').getPublicUrl(post.image_url).data.publicUrl : null;
                return (
                  <Card key={post.id} className="overflow-hidden rounded-xl shadow hover:shadow-lg transition">
                    <CardContent className="p-6">
                      <p className="mb-4">{post.content}</p>
                      {url && (
                        post.media_type?.startsWith('video/') ? (
                          <video controls className="w-full rounded-xl max-h-96 object-contain bg-black">
                            <source src={url} type={post.media_type || 'video/mp4'} />
                            Your browser does not support video.
                          </video>
                        ) : (
                          <img src={url} className="w-full rounded-xl" loading="lazy" alt="Post" />
                        )
                      )}
                      <p className="text-sm text-gray-500 text-right mt-4">
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Media Tab - Videos now play perfectly */}
          <TabsContent value="media">
            {media.length === 0 ? (
              <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                <p className="text-gray-500 text-lg">No photos or videos yet</p>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {media.map((item, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden bg-black shadow-lg group cursor-pointer">
                    {item.type.startsWith('video/') ? (
                      <video controls className="w-full h-full object-cover">
                        <source src={item.url} type={item.type} />
                        Your browser does not support video.
                      </video>
                    ) : (
                      <img src={item.url} className="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="Media" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends">
            {friends.length === 0 ? (
              <Card className="text-center py-16 bg-gray-50/70 rounded-xl">
                <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg">No friends yet</p>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {friends.map(f => (
                  <div key={f.friend_id} className="text-center p-4 bg-white rounded-xl shadow hover:shadow-lg transition">
                    <Avatar className="h-20 w-20 mx-auto mb-3 ring-4 ring-[#2ec2b3]/20">
                      <AvatarImage src={f.profiles.avatar_url} />
                      <AvatarFallback className="bg-[#2ec2b3] text-white">
                        {f.profiles.full_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium truncate">{f.profiles.full_name}</p>
                    <Button size="sm" variant="outline" className="mt-3 w-full">Message</Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;