import { useState, useEffect } from 'react';
import { Bell, X, MessageCircle, UserPlus, ThumbsUp, MessageSquare, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'message' | 'friend_request' | 'post_like' | 'post_comment' | 'task_assigned' | 'task_accepted' | 'friend_request_accepted';
  content: string;
  created_at: string;
  read: boolean;
  sender_id?: string;
  sender_name?: string;
  link?: string;
  data?: any;
}

interface ToastNotification extends Notification {
  show: boolean;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<ToastNotification | null>(null);

  // Show toast notification
  const showToast = (notification: Notification) => {
    setToastNotification({ ...notification, show: true });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setToastNotification(prev => prev ? { ...prev, show: false } : null);
      setTimeout(() => setToastNotification(null), 300);
    }, 5000);
  };

  // Fetch all notifications from database
  const fetchAllNotifications = async () => {
    if (!user) return;

    try {
      // Fetch unread messages
      const { data: messages } = await supabase
        .from('messages')
        .select('*, profiles!messages_sender_id_fkey(full_name)')
        .eq('receiver_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false });

      const messageNotifications: Notification[] = (messages || []).map(msg => ({
        id: msg.id,
        type: 'message' as const,
        content: msg.content || 'Sent you a message',
        created_at: msg.created_at,
        read: false,
        sender_id: msg.sender_id,
        sender_name: (msg.profiles as any)?.full_name || 'Someone',
        link: '/messages',
        data: { messageId: msg.id }
      }));

      // Fetch pending friend requests
      const { data: friendRequests } = await supabase
        .from('friendships')
        .select('*, profiles!friendships_user_id_fkey(full_name, avatar_url)')
        .eq('friend_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      const friendRequestNotifications: Notification[] = (friendRequests || []).map(req => ({
        id: req.id,
        type: 'friend_request' as const,
        content: 'sent you a friend request',
        created_at: req.created_at,
        read: false,
        sender_id: req.user_id,
        sender_name: (req.profiles as any)?.full_name || 'Someone',
        link: '/friends',
        data: { requestId: req.id }
      }));

      // Fetch unread post comments on user's posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user.id);

      const userPostIds = userPosts?.map(p => p.id) || [];

      if (userPostIds.length > 0) {
        const { data: postComments } = await supabase
          .from('post_comments')
          .select('*, profiles!post_comments_user_id_fkey(full_name)')
          .in('post_id', userPostIds)
          .eq('read', false)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const commentNotifications: Notification[] = (postComments || []).map(comment => ({
          id: comment.id,
          type: 'post_comment' as const,
          content: comment.content,
          created_at: comment.created_at,
          read: false,
          sender_id: comment.user_id,
          sender_name: (comment.profiles as any)?.full_name || 'Someone',
          link: '/dashboard',
          data: { postId: comment.post_id, commentId: comment.id }
        }));

        // Fetch post likes
        const { data: postLikes } = await supabase
          .from('post_likes')
          .select('*, profiles!post_likes_user_id_fkey(full_name)')
          .in('post_id', userPostIds)
          .eq('read', false)
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const likeNotifications: Notification[] = (postLikes || []).map(like => ({
          id: like.id,
          type: 'post_like' as const,
          content: 'liked your post',
          created_at: like.created_at,
          read: false,
          sender_id: like.user_id,
          sender_name: (like.profiles as any)?.full_name || 'Someone',
          link: '/dashboard',
          data: { postId: like.post_id }
        }));

        // Combine all notifications
        const allNotifications = [
          ...messageNotifications,
          ...friendRequestNotifications,
          ...commentNotifications,
          ...likeNotifications
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setNotifications(allNotifications);
        setUnreadCount(allNotifications.length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchAllNotifications();

    // Set up real-time subscriptions
    const subscriptions = [];

    // 1. Messages subscription
    const messagesChannel = supabase
      .channel('new-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const message = payload.new;
          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', message.sender_id)
            .single();

          const notification: Notification = {
            id: message.id,
            type: 'message',
            content: message.content || 'Sent you a message',
            created_at: message.created_at,
            read: false,
            sender_id: message.sender_id,
            sender_name: senderData?.full_name || 'Someone',
            link: '/messages',
            data: { messageId: message.id }
          };

          showToast(notification);
          await fetchAllNotifications();
        }
      )
      .subscribe();
    subscriptions.push(messagesChannel);

    // 2. Friend requests subscription
    const friendRequestsChannel = supabase
      .channel('new-friend-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        async (payload) => {
          const friendship = payload.new;
          if (friendship.status === 'pending') {
            const { data: senderData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', friendship.user_id)
              .single();

            const notification: Notification = {
              id: friendship.id,
              type: 'friend_request',
              content: 'sent you a friend request',
              created_at: friendship.created_at,
              read: false,
              sender_id: friendship.user_id,
              sender_name: senderData?.full_name || 'Someone',
              link: '/friends',
              data: { requestId: friendship.id }
            };

            showToast(notification);
            await fetchAllNotifications();
          }
        }
      )
      .subscribe();
    subscriptions.push(friendRequestsChannel);

    // 3. Friend request accepted subscription
    const friendAcceptedChannel = supabase
      .channel('friend-accepted')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'friendships',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const friendship = payload.new;
          if (friendship.status === 'accepted') {
            const { data: friendData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', friendship.friend_id)
              .single();

            const notification: Notification = {
              id: friendship.id,
              type: 'friend_request_accepted',
              content: 'accepted your friend request',
              created_at: friendship.created_at,
              read: false,
              sender_id: friendship.friend_id,
              sender_name: friendData?.full_name || 'Someone',
              link: '/friends',
              data: { friendshipId: friendship.id }
            };

            showToast(notification);
            await fetchAllNotifications();
          }
        }
      )
      .subscribe();
    subscriptions.push(friendAcceptedChannel);

    // 4. Task assigned subscription
    const tasksChannel = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `accepted_by=eq.${user.id}`,
        },
        async (payload) => {
          const task = payload.new;
          const { data: creatorData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', task.creator_id)
            .single();

          let notification: Notification | null = null;
          
          if (task.status === 'in_progress') {
            notification = {
              id: task.id,
              type: 'task_accepted',
              content: `Your task "${task.title}" was accepted`,
              created_at: task.updated_at || task.created_at,
              read: false,
              sender_id: task.creator_id,
              sender_name: creatorData?.full_name || 'Someone',
              link: '/tasks',
              data: { taskId: task.id }
            };
          } else if (task.status === 'pending_completion') {
            notification = {
              id: task.id,
              type: 'task_assigned',
              content: `Task "${task.title}" is pending your review`,
              created_at: task.updated_at || task.created_at,
              read: false,
              sender_id: task.accepted_by,
              sender_name: creatorData?.full_name || 'Someone',
              link: '/tasks',
              data: { taskId: task.id }
            };
          }

          if (notification) {
            showToast(notification);
            await fetchAllNotifications();
          }
        }
      )
      .subscribe();
    subscriptions.push(tasksChannel);

    // 5. Post comments subscription
    const commentsChannel = supabase
      .channel('new-comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
        },
        async (payload) => {
          const comment = payload.new;
          
          const { data: postData } = await supabase
            .from('posts')
            .select('user_id, content')
            .eq('id', comment.post_id)
            .single();

          if (postData?.user_id === user.id && comment.user_id !== user.id) {
            const { data: commenterData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', comment.user_id)
              .single();

            const notification: Notification = {
              id: comment.id,
              type: 'post_comment',
              content: comment.content,
              created_at: comment.created_at,
              read: false,
              sender_id: comment.user_id,
              sender_name: commenterData?.full_name || 'Someone',
              link: '/dashboard',
              data: { postId: comment.post_id, commentId: comment.id }
            };

            showToast(notification);
            await fetchAllNotifications();
          }
        }
      )
      .subscribe();
    subscriptions.push(commentsChannel);

    // 6. Post likes subscription
    const likesChannel = supabase
      .channel('new-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes',
        },
        async (payload) => {
          const like = payload.new;
          
          const { data: postData } = await supabase
            .from('posts')
            .select('user_id, content')
            .eq('id', like.post_id)
            .single();

          if (postData?.user_id === user.id && like.user_id !== user.id) {
            const { data: likerData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', like.user_id)
              .single();

            const notification: Notification = {
              id: like.id,
              type: 'post_like',
              content: 'liked your post',
              created_at: like.created_at,
              read: false,
              sender_id: like.user_id,
              sender_name: likerData?.full_name || 'Someone',
              link: '/dashboard',
              data: { postId: like.post_id }
            };

            showToast(notification);
            await fetchAllNotifications();
          }
        }
      )
      .subscribe();
    subscriptions.push(likesChannel);

    return () => {
      subscriptions.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return <MessageCircle className="h-4 w-4 text-blue-600" />;
      case 'friend_request':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'friend_request_accepted':
        return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'post_like':
        return <ThumbsUp className="h-4 w-4 text-red-600" />;
      case 'post_comment':
        return <MessageSquare className="h-4 w-4 text-purple-600" />;
      case 'task_assigned':
      case 'task_accepted':
        return <ClipboardCheck className="h-4 w-4 text-amber-600" />;
      default:
        return <Bell className="h-4 w-4 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'message':
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/30';
      case 'friend_request':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/30';
      case 'friend_request_accepted':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/30';
      case 'post_like':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/30';
      case 'post_comment':
        return 'border-l-purple-500 bg-purple-50 dark:bg-purple-950/30';
      case 'task_assigned':
      case 'task_accepted':
        return 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/30';
      default:
        return 'border-l-gray-500 bg-gray-50 dark:bg-gray-800';
    }
  };

  const markAsRead = async (notification: Notification) => {
    try {
      // Mark message as read
      if (notification.type === 'message') {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('id', notification.id);
      }
      // Mark comment as read
      else if (notification.type === 'post_comment') {
        await supabase
          .from('post_comments')
          .update({ read: true })
          .eq('id', notification.id);
      }
      // Mark like as read
      else if (notification.type === 'post_like') {
        await supabase
          .from('post_likes')
          .update({ read: true })
          .eq('id', notification.id);
      }
      // For friend requests and tasks, we'll just remove from notification list

      // Remove notification from list
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Navigate if there's a link
      if (notification.link) {
        navigate(notification.link);
        setOpen(false);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification);
  };

  const handleToastClick = (notification: Notification) => {
    // Hide toast
    setToastNotification(prev => prev ? { ...prev, show: false } : null);
    setTimeout(() => setToastNotification(null), 300);
    
    // Mark as read and navigate
    markAsRead(notification);
  };

  const closeToast = () => {
    setToastNotification(prev => prev ? { ...prev, show: false } : null);
    setTimeout(() => setToastNotification(null), 300);
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      // Mark all messages as read
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('read', false);


      // Clear all notifications
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  return (
    <>
      {/* Toast Notification Popup */}
      {toastNotification && (
        <div 
          className={`fixed top-4 right-4 z-50 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
            toastNotification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getNotificationIcon(toastNotification.type)}
                <span className="font-semibold text-sm">New Notification</span>
              </div>
              <button
                onClick={closeToast}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => handleToastClick(toastNotification)}
              className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-2 -m-2 transition-colors"
            >
              <p className="font-medium text-sm">{toastNotification.sender_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
                {toastNotification.content}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {formatDistanceToNow(new Date(toastNotification.created_at), { addSuffix: true })}
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Notification Bell */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 sm:w-96" align="end">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <>
                  <Badge variant="secondary">{unreadCount} new</Badge>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={markAllAsRead}
                    className="text-xs h-7"
                  >
                    Mark all read
                  </Button>
                </>
              )}
            </div>
          </div>
          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-3 rounded-lg hover:opacity-90 transition-all border-l-4 ${getNotificationColor(notification.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-sm">
                            {notification.sender_name}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {notification.content}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
}