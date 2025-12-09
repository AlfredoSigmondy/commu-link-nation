import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- ADD THIS
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
import { Heart, MessageCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';
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
}

export function PostCard({ post, currentUserId, onPostUpdate }: PostCardProps) {
  const navigate = useNavigate(); // <-- ADD THIS
  const { toast } = useToast();

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

  const isOwner = post.user_id === currentUserId;

  // Generate public media URL
  useEffect(() => {
    if (post.image_url) {
      const { data } = supabase.storage.from('posts').getPublicUrl(post.image_url);
      setMediaUrl(data.publicUrl);
    }
  }, [post.image_url]);

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
                <div className="w-full my-2 -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden bg-black">
                  {post.media_type?.startsWith('video/') ? (
                    <video controls playsInline preload="metadata" className="w-full h-auto max-h-96 object-contain">
                      <source src={mediaUrl} type={post.media_type || 'video/mp4'} />
                    </video>
                  ) : (
                    <img src={mediaUrl} alt="Post" className="w-full h-auto max-h-96 object-contain" loading="lazy" />
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