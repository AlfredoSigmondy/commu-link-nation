import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  media_type: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const { toast } = useToast();

  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [likes, setLikes] = useState<number>(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);

  // Generate PUBLIC URL for images/videos
  useEffect(() => {
    if (post.image_url) {
      const { data } = supabase.storage
        .from('posts')
        .getPublicUrl(post.image_url);

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
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId);
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: currentUserId });
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
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  return (
    <Card className="shadow-soft rounded-2xl overflow-hidden max-w-2xl mx-auto">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between w-full">
          {/* Profile Header */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 ring-2 ring-background">
              <AvatarImage src={post.profiles.avatar_url || ''} />
              <AvatarFallback>{post.profiles.full_name[0]}</AvatarFallback>
            </Avatar>

            <div>
              <p className="font-semibold text-base">{post.profiles.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>

          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* MEDIA SECTION — FIXED FOR ALL VIDEO FORMATS */}
        {mediaUrl && (
          <div className="w-full my-2 -mx-4 sm:mx-0 sm:rounded-xl overflow-hidden bg-black">
            {post.media_type?.startsWith('video/') ? (
              <video
                key={mediaUrl}
                src={mediaUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full h-auto max-h-96 sm:max-h-[520px] object-contain"
              >
                <source
                  src={mediaUrl}
                  type={post.media_type || 'video/mp4'}
                />
              </video>
            ) : (
              <img
                src={mediaUrl}
                alt="Post"
                className="w-full h-auto max-h-96 sm:max-h-[520px] object-contain bg-white"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-6">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 transition-all hover:scale-110 ${
                hasLiked ? 'text-red-500' : 'text-muted-foreground'
              }`}
            >
              <Heart className={`h-6 w-6 ${hasLiked ? 'fill-current' : ''}`} />
              <span className="font-medium text-sm">{likes}</span>
            </button>

            {/* Toggle comments */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageCircle className="h-6 w-6" />
              <span className="font-medium text-sm">{comments.length}</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComments(true)}
            className="rounded-full px-4 text-cyan-600 border-cyan-200 hover:bg-cyan-50"
          >
            Comment
          </Button>
        </div>

        {/* COMMENTS SECTION */}
        {showComments && (
          <div className="space-y-4 pt-4 border-t border-border/50">
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarImage src={comment.profiles?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">
                      {comment.profiles?.full_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 bg-muted/50 rounded-2xl px-4 py-3">
                    <p className="font-semibold text-sm">
                      {comment.profiles?.full_name || 'User'}
                    </p>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* New comment input */}
            <div className="flex gap-2 pt-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 h-11 rounded-full text-sm"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />

              <Button
                onClick={handleComment}
                size="sm"
                className="h-11 px-6 rounded-full"
                disabled={!newComment.trim()}
              >
                Post
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
