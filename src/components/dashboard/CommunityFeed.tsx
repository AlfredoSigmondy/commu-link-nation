// CommunityFeed.tsx
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Video, Smile, X, Loader2 } from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { supabase } from '@/integrations/supabase/client';
import { PostCard } from './PostCard';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  media_type: string | null;
  created_at: string;
  status: string;
  profiles: { full_name: string; avatar_url: string | null };
}

const CommunityFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const profile = user?.user_metadata;
  const firstName = profile?.full_name?.split(' ')[0] || 'friend';

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel('posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(full_name, avatar_url)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    setPosts(data as Post[]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Too big', description: 'Max 50MB', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({ title: 'Invalid', description: 'Only images & videos', variant: 'destructive' });
      return;
    }

    setMediaFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadMedia = async () => {
    if (!mediaFile || !user) return null;
    const ext = mediaFile.name.split('.').pop();
    const path = `posts/${user.id}/${Date.now()}.${ext}`;
    const { error, data } = await supabase.storage.from('posts').upload(path, mediaFile, { upsert: true });
    if (error) throw error;
    return { path: data.path, type: mediaFile.type };
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !mediaFile && !feeling) return;
    setIsPosting(true);

    try {
      let image_url = null;
      let media_type = null;
      if (mediaFile) {
        const uploaded = await uploadMedia();
        if (uploaded) {
          image_url = uploaded.path;
          media_type = uploaded.type;
        }
      }

      const contentWithFeeling = feeling
        ? `${newPost.trim()} ${feeling}`
        : newPost.trim();

      await supabase.from('posts').insert({
        user_id: user!.id,
        content: contentWithFeeling || null,
        image_url,
        media_type,
        status: 'pending',
      });

      toast({ title: 'Posted!', description: 'Your post is under review.' });
      closeModal();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsPosting(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewPost('');
    setFeeling(null);
    setMediaFile(null);
    setPreviewUrl(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };

  const addFeeling = (emoji: any) => {
    setFeeling(emoji.native);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Compact Top Bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>{firstName[0]}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 text-left bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 text-gray-600 text-sm md:text-base transition"
            >
              <span className="inline md:hidden">Concern, {firstName}?</span>
              <span className="hidden md:inline">What's your concern, {firstName}?</span>
            </button>
          </div>

          <div className="flex justify-around mt-3 pt-3 border-t">
            <label className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded cursor-pointer">
              <Video className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-700">Video</span>
              <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden"
                onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} />
            </label>

            <label className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded cursor-pointer">
              <ImageIcon className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Photo</span>
              <input type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden"
                onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} />
            </label>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded"
            >
              <Smile className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Feeling</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Create Post Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create Post</h2>
            {/* Removed the extra close button here */}
          </div>

          <div className="p-6 pt-4 space-y-5">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>{firstName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile?.full_name || 'User'}</p>
                <p className="text-sm text-gray-500">Public</p>
              </div>
            </div>

            <Textarea
              placeholder={`What's  concern, ${firstName}?`}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="border-0 resize-none focus-visible:ring-0 text-lg min-h-32 p-0"
              autoFocus
            />

            {feeling && (
              <span className="text-2xl ml-2">{feeling}</span>
            )}

            {previewUrl && (
              <div className="relative rounded-xl overflow-hidden bg-black">
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={previewUrl} controls className="w-full max-h-96 object-contain" />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full max-h-96 object-contain" />
                )}
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-3 right-3 rounded-full h-9 w-9"
                  onClick={() => {
                    setMediaFile(null);
                    setPreviewUrl(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex gap-4">
                <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition">
                  <ImageIcon className="h-6 w-6 text-green-500" />
                  <input type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                </label>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition">
                      <Smile className="h-6 w-6 text-yellow-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0 shadow-lg" align="start">
                    <Picker
                      data={data}
                      onEmojiSelect={addFeeling}
                      theme="light"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <Button
                onClick={handleCreatePost}
                disabled={isPosting || (!newPost.trim() && !mediaFile && !feeling)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 font-medium"
              >
                {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Feed */}
      <div className="space-y-4 pb-10">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={user?.id || ''} />
        ))}
      </div>
    </div>
  );
};

export default CommunityFeed;