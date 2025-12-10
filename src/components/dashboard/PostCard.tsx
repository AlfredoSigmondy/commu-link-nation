import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, MoreVertical, Edit2, Trash2, Play, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  media_type: string | null;
  user_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onPostUpdate?: () => void;
  currentlyPlayingVideo: string | null;
  setCurrentlyPlayingVideo: (postId: string | null) => void;
}

export function PostCard({ 
  post, 
  currentUserId, 
  onPostUpdate, 
  currentlyPlayingVideo,
  setCurrentlyPlayingVideo 
}: PostCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Video controls state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showVideoControls, setShowVideoControls] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const isOwner = post.user_id === currentUserId;
  const isVideo = post.media_type?.startsWith('video/');
  const isCurrentVideoPlaying = currentlyPlayingVideo === post.id;

  // Generate public media URL
  useEffect(() => {
    if (post.image_url) {
      const { data } = supabase.storage.from('posts').getPublicUrl(post.image_url);
      setMediaUrl(data.publicUrl);
    }
  }, [post.image_url]);

  // Setup Intersection Observer for auto-play
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Only play if no other video is playing
          if (!currentlyPlayingVideo) {
            setCurrentlyPlayingVideo(post.id);
            videoRef.current?.play().catch(() => {
              // Auto-play was prevented, show play button
              setCurrentlyPlayingVideo(null);
            });
          }
        } else if (isCurrentVideoPlaying) {
          videoRef.current?.pause();
          setCurrentlyPlayingVideo(null);
        }
      });
    };

    observerRef.current = new IntersectionObserver(
      handleIntersection,
      { 
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px' // Play when 100px from bottom of viewport
      }
    );

    observerRef.current.observe(videoRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isVideo, post.id, currentlyPlayingVideo, isCurrentVideoPlaying, setCurrentlyPlayingVideo]);

  // Handle video play/pause
  useEffect(() => {
    if (!videoRef.current) return;

    if (isCurrentVideoPlaying) {
      videoRef.current.muted = isMuted;
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
      }).catch(() => {
        setIsVideoPlaying(false);
      });
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  }, [isCurrentVideoPlaying, isMuted]);

  // Fetch likes
  const fetchLikes = useCallback(async () => {
    const { count } = await supabase
      .from('post_likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id);

    const { data: userLike } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', post.id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    setLikes(count || 0);
    setHasLiked(!!userLike);
  }, [post.id, currentUserId]);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('post_comments')
      .select(`
        id,
        content,
        created_at,
        profiles!post_comments_user_id_fkey(full_name, avatar_url)
      `)
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (data) setComments(data);
  }, [post.id]);

  useEffect(() => {
    fetchLikes();
    fetchComments();
  }, [fetchLikes, fetchComments]);

  // Video event handlers
  const handleVideoPlayClick = () => {
    if (isCurrentVideoPlaying) {
      setCurrentlyPlayingVideo(null);
    } else {
      // Stop any currently playing video
      setCurrentlyPlayingVideo(post.id);
    }
  };

  const handleVideoMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setVideoProgress(progress);
    }
  };

  const handleVideoEnded = () => {
    setCurrentlyPlayingVideo(null);
    setIsVideoPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleVideoClick = () => {
    if (isVideoPlaying) {
      setCurrentlyPlayingVideo(null);
    } else {
      setCurrentlyPlayingVideo(post.id);
    }
  };

  // Like handler
  const handleLike = async () => {
    if (hasLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });
    }
    fetchLikes();
  };

  // Comment handler
  const handleComment = async () => {
    if (!newComment.trim()) return;

    const { error } = await supabase
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: currentUserId,
        content: newComment.trim(),
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  // Edit post
  const handleEdit = async () => {
    if (!editedContent.trim()) return toast({ title: "Empty", description: "Write something", variant: "destructive" });

    setIsSubmitting(true);
    const { error } = await supabase
      .from('posts')
      .update({ content: editedContent.trim() })
      .eq('id', post.id);

    setIsSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Post updated!" });
      setIsEditMode(false);
      onPostUpdate?.();
    }
  };

  // Delete post
  const handleDelete = async () => {
    setIsSubmitting(true);
    if (post.image_url) {
      await supabase.storage.from('posts').remove([post.image_url]);
    }

    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    setIsSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Post removed" });
      onPostUpdate?.();
    }
  };

  const goToProfile = () => {
    if (!post.user_id) {
      console.error('Post has no user_id!', post);
      return;
    }

    if (post.user_id === currentUserId) {
      navigate('/profile');
    } else {
      navigate(`/public-profile/${post.user_id}`);
    }
  };

  return (
    <>
      <Card className="shadow-soft rounded-2xl overflow-hidden max-w-2xl mx-auto bg-white">
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between w-full">
            {/* Clickable Profile Section */}
            <button
              onClick={goToProfile}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-10 w-10 ring-2 ring-background">
                <AvatarImage src={post.profiles.avatar_url || ''} />
                <AvatarFallback>{post.profiles.full_name[0]}</AvatarFallback>
              </Avatar>

              <div className="text-left">
                <p className="font-semibold text-base">{post.profiles.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>
            </button>

            {/* Owner Menu */}
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => { setEditedContent(post.content); setIsEditMode(true); }}>
                    <Edit2 className="h-4 w-4 mr-2" /> Edit Post
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-4">
          {/* Edit Mode */}
          {isEditMode ? (
            <div className="space-y-3">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="min-h-32 resize-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsEditMode(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEdit}
                  disabled={isSubmitting || !editedContent.trim()}
                  className="bg-[#2ec2b3] hover:bg-[#28a399]"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{post.content}</p>

              {mediaUrl && (
                <div 
                  className="relative w-full my-2 -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden bg-black group"
                  onMouseEnter={() => setShowVideoControls(true)}
                  onMouseLeave={() => setShowVideoControls(false)}
                >
                  {isVideo ? (
                    <>
                      <video
                        ref={videoRef}
                        onClick={handleVideoClick}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onEnded={handleVideoEnded}
                        className="w-full h-auto max-h-[500px] object-contain cursor-pointer"
                        playsInline
                        preload="metadata"
                        muted={isMuted}
                        loop
                      >
                        <source src={mediaUrl} type={post.media_type || 'video/mp4'} />
                        Your browser does not support the video tag.
                      </video>

                      {/* Video overlay and controls */}
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showVideoControls || !isVideoPlaying ? 'opacity-100' : 'opacity-0'}`}>
                        {/* Play/Pause Button */}
                        {!isVideoPlaying && (
                          <button
                            onClick={handleVideoPlayClick}
                            className="absolute inset-0 flex items-center justify-center bg-black/30"
                          >
                            <div className="bg-white/90 p-4 rounded-full hover:bg-white transition-all transform hover:scale-105">
                              <Play className="h-12 w-12 text-black ml-1" fill="black" />
                            </div>
                          </button>
                        )}

                        {/* Bottom controls bar */}
                        <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-transform duration-300 ${showVideoControls || !isVideoPlaying ? 'translate-y-0' : 'translate-y-full'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleVideoPlayClick}
                                className="text-white hover:bg-white/20 p-2 rounded-full"
                              >
                                {isVideoPlaying ? (
                                  <div className="h-8 w-8 flex items-center justify-center">
                                    <div className="h-4 w-1.5 bg-white mx-0.5" />
                                    <div className="h-4 w-1.5 bg-white mx-0.5" />
                                  </div>
                                ) : (
                                  <Play className="h-8 w-8" fill="white" />
                                )}
                              </button>
                              
                              <button
                                onClick={handleVideoMuteToggle}
                                className="text-white hover:bg-white/20 p-2 rounded-full"
                              >
                                {isMuted ? (
                                  <VolumeX className="h-6 w-6" />
                                ) : (
                                  <Volume2 className="h-6 w-6" />
                                )}
                              </button>
                            </div>

                            {/* Progress bar */}
                            <div className="flex-1 mx-4">
                              <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-white rounded-full"
                                  style={{ width: `${videoProgress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Image display
                    <div className="relative group">
                      <img 
                        src={mediaUrl} 
                        alt="Post" 
                        className="w-full h-auto max-h-[500px] object-contain cursor-pointer hover:opacity-95 transition-opacity"
                        loading="lazy"
                        onClick={() => window.open(mediaUrl, '_blank')}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Actions */}
          {!isEditMode && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-6">
                <button onClick={handleLike} className={`flex items-center gap-2 ${hasLiked ? 'text-red-500' : ''}`}>
                  <Heart className={`h-6 w-6 ${hasLiked ? 'fill-current' : ''}`} />
                  <span className="font-medium text-sm">{likes}</span>
                </button>

                <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2">
                  <MessageCircle className="h-6 w-6" />
                  <span className="font-medium text-sm">{comments.length}</span>
                </button>
              </div>
            </div>
          )}

          {/* Comments */}
          {showComments && !isEditMode && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={comment.profiles?.avatar_url || ''} />
                      <AvatarFallback>{comment.profiles?.full_name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 bg-muted/50 rounded-2xl px-4 py-3">
                      <p className="font-semibold text-sm">{comment.profiles?.full_name || 'User'}</p>
                      <p className="text-sm mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 h-11 rounded-full"
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleComment())}
                />
                <Button onClick={handleComment} className="h-11 px-6 rounded-full bg-[#2ec2b3]" disabled={!newComment.trim()}>
                  Post
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600" disabled={isSubmitting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}