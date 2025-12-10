import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Image as ImageIcon, Video, Smile, X, Loader2, Eye, CheckCircle, Clock } from 'lucide-react';
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
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  is_pinned: boolean;
  pinned_at: string | null;
  profiles: { 
    id: string;
    full_name: string; 
    avatar_url: string | null;
    role?: string;
  };
}

// Utility function to check if user is admin
async function isUserAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
    
  if (error || !data) return false;
  
  return data.role === 'admin';
}

const CommunityFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPost, setNewPost] = useState('');
  const [feeling, setFeeling] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'pending'>('feed');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Track currently playing video across all posts
  const [currentlyPlayingVideo, setCurrentlyPlayingVideo] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const profile = user?.user_metadata;
  const firstName = profile?.full_name?.split(' ')[0] || 'friend';

  useEffect(() => {
    // Check if current user is admin
    const checkAdminStatus = async () => {
      if (user?.id) {
        const adminStatus = await isUserAdmin(user.id);
        setIsAdmin(adminStatus);
      }
    };
    
    checkAdminStatus();
    fetchPosts();
    if (isAdmin) {
      fetchPendingPosts();
    }
    
    // Set up real-time subscription for new posts
    const channel = supabase
      .channel('posts')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'posts' 
        },
        (payload) => {
          // Refresh posts when there are changes
          fetchPosts();
          if (isAdmin) {
            fetchPendingPosts();
          }
          
          // If a post was deleted and it was the currently playing video, clear it
          if (payload.eventType === 'DELETE' && payload.old?.id === currentlyPlayingVideo) {
            setCurrentlyPlayingVideo(null);
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isAdmin]);

  // Pause video when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setCurrentlyPlayingVideo(null);
    }
  }, [isModalOpen]);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, role)')
      .eq('status', 'approved')
      // CRITICAL: Sort pinned posts first, then by creation date
      .order('is_pinned', { ascending: false }) // Pinned posts first (false = true values first)
      .order('pinned_at', { ascending: false, nullsLast: true }) // Most recent pinned first
      .order('created_at', { ascending: false }); // Then newest posts
    
    if (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive'
      });
      return;
    }
    
    setPosts(data as Post[]);
  };

  const fetchPendingPosts = async () => {
    if (!isAdmin) return;
    
    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles(id, full_name, avatar_url, role)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching pending posts:', error);
      return;
    }
    
    setPendingPosts(data as Post[]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size validation (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast({ 
        title: 'File too large', 
        description: 'Maximum file size is 50MB', 
        variant: 'destructive' 
      });
      return;
    }

    // File type validation
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast({ 
        title: 'Invalid file type', 
        description: 'Only images and videos are allowed', 
        variant: 'destructive' 
      });
      return;
    }

    setMediaFile(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setPreviewUrl(previewUrl);
    
    // Open modal if not already open
    if (!isModalOpen) {
      setIsModalOpen(true);
    }
  };

  const uploadMedia = async () => {
    if (!mediaFile || !user) return null;
    
    const fileExt = mediaFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `posts/${user.id}/${fileName}`;
    
    const { error, data } = await supabase.storage
      .from('posts')
      .upload(filePath, mediaFile, { 
        cacheControl: '3600',
        upsert: true 
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    return { 
      path: data.path, 
      type: mediaFile.type 
    };
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !mediaFile && !feeling) {
      toast({
        title: 'Empty post',
        description: 'Please add some content',
        variant: 'destructive'
      });
      return;
    }
    
    setIsPosting(true);

    try {
      let image_url = null;
      let media_type = null;
      
      // Upload media if exists
      if (mediaFile) {
        const uploaded = await uploadMedia();
        if (uploaded) {
          image_url = uploaded.path;
          media_type = uploaded.type;
        }
      }

      // Combine post content with feeling emoji
      const contentWithFeeling = feeling
        ? `${newPost.trim()} ${feeling}`
        : newPost.trim();

      // Check if user is admin
      const isAdminUser = await isUserAdmin(user!.id);
      
      // Prepare post data
  const postData = {
    user_id: user!.id,
    content: contentWithFeeling || null,
    image_url,
    media_type,
    status: isAdminUser ? 'approved' : 'pending',
    is_pinned: isAdminUser ? true : false,
    pinned_at: isAdminUser ? new Date().toISOString() : null
  };

  const { error } = await supabase
    .from('posts')
    .insert(postData as any);

      if (error) throw error;

      toast({ 
        title: 'Post submitted!', 
        description: isAdminUser 
          ? 'Your admin post has been approved and pinned to the top!' 
          : 'Your post is under review and will appear soon after approval.' 
      });
      
      closeModal();
    } catch (err: any) {
      console.error('Create post error:', err);
      toast({ 
        title: 'Error creating post', 
        description: err.message || 'Please try again', 
        variant: 'destructive' 
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'approved' })
        .eq('id', postId);

      if (error) throw error;

      toast({ 
        title: 'Post approved!', 
        description: 'The post is now visible in the feed.' 
      });
      
      fetchPosts();
      fetchPendingPosts();
    } catch (err: any) {
      console.error('Approve post error:', err);
      toast({ 
        title: 'Error approving post', 
        description: err.message || 'Please try again', 
        variant: 'destructive' 
      });
    }
  };

  const handleRejectPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ status: 'rejected' })
        .eq('id', postId);

      if (error) throw error;

      toast({ 
        title: 'Post rejected', 
        description: 'The post has been rejected and will not appear in the feed.' 
      });
      
      fetchPendingPosts();
    } catch (err: any) {
      console.error('Reject post error:', err);
      toast({ 
        title: 'Error rejecting post', 
        description: err.message || 'Please try again', 
        variant: 'destructive' 
      });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewPost('');
    setFeeling(null);
    setMediaFile(null);
    
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const addFeeling = (emoji: any) => {
    setFeeling(emoji.native);
  };

  const handleRefreshPosts = () => {
    fetchPosts();
    if (isAdmin) {
      fetchPendingPosts();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Create Post Card */}
      <Card className="border-0 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar className="h-10 w-10 ring-2 ring-background">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>{firstName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 text-left bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-3 text-gray-600 text-sm md:text-base transition-all duration-200"
            >
              <span className="opacity-80">What's your concern, {firstName}?</span>
            </button>
          </div>

          <div className="flex justify-around border-t pt-3">
            <label className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
              <Video className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-700">Video</span>
              <input 
                type="file" 
                accept="video/*" 
                onChange={handleFileSelect} 
                className="hidden"
              />
            </label>

            <label className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors duration-200">
              <ImageIcon className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Photo</span>
              <input 
                type="file" 
                accept="image/*,video/*" 
                onChange={handleFileSelect} 
                className="hidden"
              />
            </label>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex flex-1 justify-center items-center gap-2 py-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <Smile className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-700">Feeling</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Tabs */}
      {isAdmin && (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'feed' | 'pending')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="feed" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Public Feed
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Review
              {pendingPosts.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {pendingPosts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="feed" className="mt-6">
            {/* Feed content will be shown below */}
          </TabsContent>
          
          <TabsContent value="pending" className="mt-6">
            {pendingPosts.length === 0 ? (
              <div className="text-center py-12 border rounded-xl">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending posts</h3>
                <p className="text-gray-500">All posts have been reviewed.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingPosts.map((post) => (
                  <Card key={post.id} className="border-2 border-yellow-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={post.profiles?.avatar_url || ''} />
                            <AvatarFallback>{post.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{post.profiles?.full_name || 'User'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(post.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>
                      
                      <p className="mb-4">{post.content}</p>
                      
                      {post.image_url && (
                        <div className="mb-4">
                          <img 
                            src={supabase.storage.from('posts').getPublicUrl(post.image_url).data.publicUrl} 
                            alt="Post" 
                            className="w-full h-auto max-h-96 object-contain rounded-lg"
                          />
                        </div>
                      )}
                      
                      <div className="flex gap-3">
                        <Button 
                          onClick={() => handleApprovePost(post.id)}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                        <Button 
                          onClick={() => handleRejectPost(post.id)}
                          variant="destructive"
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Create Post Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) closeModal();
      }}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden rounded-2xl">
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Create Post</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeModal}
              className="h-8 w-8 rounded-full"
            >
              
            </Button>
          </div>

          <div className="p-6 pt-4 space-y-5">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback>{firstName?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{profile?.full_name || 'User'}</p>
                <p className="text-sm text-muted-foreground">Public</p>
              </div>
            </div>

            <Textarea
              placeholder={`What's your concern?, ${firstName}?`}
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="border-0 resize-none focus-visible:ring-0 text-lg min-h-32 p-0 placeholder:text-gray-400"
              autoFocus
            />

            {feeling && (
              <div className="flex items-center gap-2">
                <span className="text-lg">Feeling:</span>
                <span className="text-2xl">{feeling}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFeeling(null)}
                  className="h-6 w-6 p-0 ml-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {previewUrl && (
              <div className="relative rounded-xl overflow-hidden bg-black">
                {mediaFile?.type.startsWith('video/') ? (
                  <video 
                    src={previewUrl} 
                    controls 
                    className="w-full max-h-96 object-contain"
                    preload="metadata"
                  />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full max-h-96 object-contain"
                  />
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
              <div className="flex gap-2">
                <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors duration-200">
                  <ImageIcon className="h-6 w-6 text-green-500" />
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={handleFileSelect} 
                    className="hidden" 
                  />
                </label>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200">
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
                className="bg-[#2ec2b3] hover:bg-[#28a399] text-white px-8 font-medium transition-colors duration-200"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Posting...
                  </>
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Posts Feed - Only show when on feed tab or if not admin */}
      {(activeTab === 'feed' || !isAdmin) && (
        <div className="space-y-6 pb-10">
          {posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No posts yet. Be the first to share!</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id || ''}
                onPostUpdate={handleRefreshPosts}
                currentlyPlayingVideo={currentlyPlayingVideo}
                setCurrentlyPlayingVideo={setCurrentlyPlayingVideo}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;