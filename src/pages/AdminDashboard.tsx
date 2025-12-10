import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Check, X, Send, ClipboardList, CheckCircle, 
  Flag, AlertTriangle, UserX, Shield, Filter, Search, Users,
  Clock, User, MessageSquare, Eye, Ban, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingPost {
  id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string };
}

interface DirectApproach {
  id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  user_id: string;
  profiles: { full_name: string };
}

interface Message {
  id: string;
  approach_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: { full_name: string };
  sender_name?: string;
}

interface TaskReport {
  id: string;
  task_id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  admin_notes: string | null;
  admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;
  reporter: { full_name: string; email?: string };
  reported_user: { full_name: string; email?: string; is_admin?: boolean };
  task: { title: string; creator_id: string; description?: string };
}

interface UserBan {
  id: string;
  user_id: string;
  ban_type: 'temporary' | 'permanent' | 'posting_restriction';
  reason: string;
  duration: string | null;
  expires_at: string | null;
  admin_id: string | null;
  created_at: string;
  is_active: boolean;
  user: { full_name: string; email: string };
}

interface AdminStats {
  pendingPosts: number;
  activeRequests: number;
  pendingReports: number;
  activeBans: number;
  totalUsers: number;
  reportedUsers: number;
  activeTasks: number;
}

interface UserReportHistory {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  reporter_name: string;
}

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [approaches, setApproaches] = useState<DirectApproach[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: Message[] }>({});
  const [newMessage, setNewMessage] = useState<{ [key: string]: string }>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  // Report management
  const [taskReports, setTaskReports] = useState<TaskReport[]>([]);
  const [userBans, setUserBans] = useState<UserBan[]>([]);
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'reviewing' | 'resolved'>('all');
  const [banFilter, setBanFilter] = useState<'all' | 'active' | 'expired'>('all');
  const [reportNotes, setReportNotes] = useState<{ [key: string]: string }>({});
  const [reportSeverity, setReportSeverity] = useState<{ [key: string]: string }>({});
  const [adminStats, setAdminStats] = useState<AdminStats>({
    pendingPosts: 0,
    activeRequests: 0,
    pendingReports: 0,
    activeBans: 0,
    totalUsers: 0,
    reportedUsers: 0,
    activeTasks: 0
  });
  const [isUserAdmin, setIsUserAdmin] = useState<boolean>(false);
  
  // User details modal
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userReports, setUserReports] = useState<UserReportHistory[]>([]);
  const [userBansList, setUserBansList] = useState<any[]>([]);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banDuration, setBanDuration] = useState('24');
  const [banReason, setBanReason] = useState('');

  const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // FIX 5: Admin Status Check - Better error handling
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsUserAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle(); // Use maybeSingle instead of single

        if (error) {
          console.error('Error checking admin status:', error);
          setIsUserAdmin(false);
          toast({
            title: "Access Error",
            description: "Could not verify admin status",
            variant: "destructive"
          });
          navigate('/dashboard');
          return;
        }

        if (!data) {
          setIsUserAdmin(false);
          toast({
            title: "Access Denied",
            description: "User profile not found",
            variant: "destructive"
          });
          navigate('/dashboard');
          return;
        }

        setIsUserAdmin(data.is_admin || false);
        
        if (!data.is_admin) {
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges",
            variant: "destructive"
          });
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsUserAdmin(false);
        navigate('/dashboard');
      }
    };

    checkAdminStatus();
  }, [user, navigate, toast]);

  // Fetch all data
  useEffect(() => {
    if (!isUserAdmin) return;

    const fetchData = async () => {
      await Promise.all([
        fetchPendingPosts(), 
        fetchApproaches(), 
        fetchTaskReports(),
        fetchUserBans(),
        fetchAdminStats()
      ]);
    };

    fetchData();

    // Real-time subscriptions
    const postsChannel = supabase
      .channel('admin-posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPendingPosts();
      })
      .subscribe();

    const approachesChannel = supabase
      .channel('admin-approaches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_approaches' }, () => {
        fetchApproaches();
      })
      .subscribe();

    const reportsChannel = supabase
      .channel('admin-task-reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_reports' }, () => {
        fetchTaskReports();
      })
      .subscribe();

    const bansChannel = supabase
      .channel('admin-user-bans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_bans' }, () => {
        fetchUserBans();
      })
      .subscribe();

    return () => {
      supabase.removeAllChannels();
    };
  }, [isUserAdmin]);

  // ADDITIONAL FIX: Stats calculation should be in separate effect
  useEffect(() => {
    if (!isUserAdmin) return;
    
    fetchAdminStats();
  }, [isUserAdmin, pendingPosts.length, approaches.length, taskReports.length, userBans.length]);

  const fetchAdminStats = async () => {
    try {
      const [
        { count: totalUsers },
        { count: reportedUsers },
        { count: activeTasks }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('task_reports').select('reported_user_id', { count: 'exact', head: true }),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'completed')
      ]);

      setAdminStats(prev => ({
        ...prev,
        totalUsers: totalUsers || 0,
        reportedUsers: reportedUsers || 0,
        activeTasks: activeTasks || 0,
        pendingPosts: pendingPosts.length,
        activeRequests: approaches.length,
        pendingReports: taskReports.filter(r => r.status === 'pending').length,
        activeBans: userBans.filter(b => b.is_active).length
      }));
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    }
  };

  const fetchPendingPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('id, content, created_at, profiles(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingPosts(data || []);
  };

  const fetchApproaches = async () => {
    const { data } = await supabase
      .from('direct_approaches')
      .select('id, subject, message, status, created_at, user_id, profiles(full_name)')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (data) {
      setApproaches(data);
      data.forEach(a => fetchMessages(a.id));
    }
  };

  const fetchMessages = async (approachId: string) => {
    const { data, error } = await supabase
      .from('approach_messages')
      .select('id, message, sender_id, created_at')
      .eq('approach_id', approachId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    const messagesWithNames = await Promise.all(
      data.map(async (msg) => {
        if (msg.sender_id === user?.id) {
          return { ...msg, sender_name: 'You' };
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', msg.sender_id)
          .single();

        return {
          ...msg,
          sender_name: profile?.full_name || (msg.sender_id === user?.id ? 'You' : 'Barangay'),
        };
      })
    );

    setMessages(prev => ({ ...prev, [approachId]: messagesWithNames }));
  };

  // FIX 6: Fetch Task Reports - Proper null handling
  const fetchTaskReports = async () => {
    if (!isUserAdmin) return;

    console.log('Fetching task reports...');
    
    try {
      const { data: reports, error: reportsError } = await supabase
        .from('task_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (reportsError) {
        console.error('Error fetching task reports:', reportsError);
        toast({
          title: "Error",
          description: "Failed to load reports",
          variant: "destructive"
        });
        setTaskReports([]);
        return;
      }

      if (!reports || reports.length === 0) {
        setTaskReports([]);
        return;
      }

      // Enrich reports with related data
      const enrichedReports = await Promise.all(
        reports.map(async (report) => {
          // Default fallback data
          let enrichedReport: TaskReport = {
            ...report,
            reporter: { full_name: 'Unknown User', email: 'unknown@example.com' },
            reported_user: { full_name: 'Unknown User', email: 'unknown@example.com', is_admin: false },
            task: { title: 'Task Not Found', creator_id: '', description: '' }
          };

          try {
            // Fetch all data in parallel
            const [reporterResult, reportedResult, taskResult] = await Promise.all([
              supabase
                .from('profiles')
                .select('full_name, email, is_admin')
                .eq('id', report.reporter_id)
                .maybeSingle(),
              supabase
                .from('profiles')
                .select('full_name, email, is_admin')
                .eq('id', report.reported_user_id)
                .maybeSingle(),
              supabase
                .from('tasks')
                .select('title, creator_id, description')
                .eq('id', report.task_id)
                .maybeSingle()
            ]);

            // Update with fetched data if available
            if (reporterResult.data) {
              enrichedReport.reporter = reporterResult.data;
            }
            if (reportedResult.data) {
              enrichedReport.reported_user = reportedResult.data;
            }
            if (taskResult.data) {
              enrichedReport.task = taskResult.data;
            }
          } catch (error) {
            console.error('Error enriching report:', error);
          }

          return enrichedReport;
        })
      );

      setTaskReports(enrichedReports);
      
    } catch (error) {
      console.error('Unexpected error fetching reports:', error);
      toast({
        title: "Unexpected Error",
        description: "Failed to load reports",
        variant: "destructive"
      });
      setTaskReports([]);
    }
  };

  const fetchUserBans = async () => {
    if (!isUserAdmin) return;

    console.log('Fetching user bans...');
    
    try {
      // Step 1: Get all bans
      const { data: bans, error: bansError } = await supabase
        .from('user_bans')
        .select('*')
        .order('created_at', { ascending: false });

      if (bansError) {
        console.error('Error fetching user bans:', bansError);
        return;
      }

      console.log('Found bans:', bans?.length || 0);

      if (!bans || bans.length === 0) {
        setUserBans([]);
        return;
      }

      // Step 2: Manually fetch user profiles
      const enrichedBans = await Promise.all(
        bans.map(async (ban) => {
          try {
            // Fetch user profile
            let userProfile = null;
            try {
              const { data } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', ban.user_id)
                .single();
              userProfile = data;
            } catch (profileError) {
              console.error('Error fetching user profile:', profileError);
            }

            return {
              ...ban,
              user: userProfile || { 
                full_name: 'Unknown User', 
                email: 'unknown@example.com' 
              }
            };
          } catch (error) {
            console.error('Error enriching ban:', error);
            return {
              ...ban,
              user: { full_name: 'Error', email: '' }
            };
          }
        })
      );

      console.log('Enriched bans:', enrichedBans);
      setUserBans(enrichedBans);
      
    } catch (error) {
      console.error('Unexpected error fetching bans:', error);
    }
  };

  // FIX 7: Update Report Status - Better validation
  // FIX 7: Update Report Status - Better validation WITH INSTANT UI UPDATE
const handleUpdateReportStatus = async (
  reportId: string, 
  status: TaskReport['status'], 
  isValid: boolean
) => {
  console.log(`🔄 Updating report ${reportId} to ${status}`);
  
  if (!user) {
    toast({
      title: "Error",
      description: "User not authenticated",
      variant: "destructive"
    });
    return;
  }

  setIsUpdating(reportId);
  
  try {
    const updateData: any = {
      status,
      resolved_at: status === 'resolved' || status === 'dismissed' 
        ? new Date().toISOString() 
        : null,
      admin_id: user.id,
      admin_notes: reportNotes[reportId]?.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (reportSeverity[reportId]) {
      updateData.severity = reportSeverity[reportId];
    }

    console.log('📦 Update data:', updateData);

    // 1. FIRST UPDATE THE LOCAL STATE IMMEDIATELY (Optimistic Update)
    setTaskReports(prevReports => 
      prevReports.map(report => {
        if (report.id === reportId) {
          console.log('✅ Updating UI for report:', reportId, 'to', status);
          return {
            ...report,
            status: updateData.status,
            resolved_at: updateData.resolved_at,
            admin_id: updateData.admin_id,
            admin_notes: updateData.admin_notes,
            updated_at: updateData.updated_at,
            ...(updateData.severity && { severity: updateData.severity })
          };
        }
        return report;
      })
    );

    // 2. THEN UPDATE THE DATABASE
    const { error } = await supabase
      .from('task_reports')
      .update(updateData)
      .eq('id', reportId);

    if (error) {
      console.error('❌ Database update error:', error);
      // If there's an error, revert the local state update
      setTaskReports(prevReports => 
        prevReports.map(report => {
          if (report.id === reportId) {
            // Re-fetch the original report data from backup or reload all
            fetchTaskReports(); // Fallback: reload all reports
          }
          return report;
        })
      );
      throw error;
    }

    console.log('✅ Database update successful');

    toast({
      title: "Report updated",
      description: `Report marked as ${status}`
    });

    // Clear temporary state
    setReportNotes(prev => {
      const { [reportId]: _, ...rest } = prev;
      return rest;
    });

    setReportSeverity(prev => {
      const { [reportId]: _, ...rest } = prev;
      return rest;
    });

    console.log('🎯 Report update complete');
    
  } catch (error: any) {
    console.error('❌ Error updating report:', error);
    toast({
      title: "Error",
      description: error.message || "Failed to update report",
      variant: "destructive"
    });
  } finally {
    setIsUpdating(null);
  }
};

  const handleManageBan = async (banId: string, action: 'activate' | 'deactivate' | 'delete') => {
    setIsUpdating(banId);
    
    try {
      if (action === 'delete') {
        const { error } = await supabase
          .from('user_bans')
          .delete()
          .eq('id', banId);
        
        if (error) throw error;
        
        toast({ title: "Ban removed" });
      } else {
        const { error } = await supabase
          .from('user_bans')
          .update({ 
            is_active: action === 'activate',
            admin_id: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', banId);
        
        if (error) throw error;
        
        toast({ 
          title: action === 'activate' ? "Ban activated" : "Ban deactivated" 
        });
      }

      fetchUserBans();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const fetchUserDetails = async (userId: string) => {
  try {
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw profileError;
    }

    // Get user's reports - SIMPLIFIED QUERY
    const { data: reports, error: reportsError } = await supabase
      .from('task_reports')
      .select('id, reason, status, created_at, reporter_id')
      .eq('reported_user_id', userId)
      .order('created_at', { ascending: false });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      throw reportsError;
    }

    // Get reporter names for each report
    const reportsWithNames = await Promise.all(
      (reports || []).map(async (report) => {
        try {
          const { data: reporterProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', report.reporter_id)
            .maybeSingle();

          return {
            ...report,
            reporter_name: reporterProfile?.full_name || 'Unknown User'
          };
        } catch (error) {
          console.error('Error fetching reporter name:', error);
          return {
            ...report,
            reporter_name: 'Error loading name'
          };
        }
      })
    );

    // Get user's bans
    const { data: bans, error: bansError } = await supabase
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (bansError) {
      console.error('Error fetching bans:', bansError);
      throw bansError;
    }

    setSelectedUser(profile);
    setUserReports(reportsWithNames);
    setUserBansList(bans || []);
    setUserDialogOpen(true);
    
    console.log('User details loaded successfully:', {
      profile,
      reportsCount: reportsWithNames.length,
      bansCount: bans?.length || 0
    });
    
  } catch (error: any) {
    console.error('Error in fetchUserDetails:', error);
    toast({
      title: "Error",
      description: error.message || "Failed to load user details",
      variant: "destructive"
    });
  }
};

  // FIX 8: Apply Ban - Proper duration handling
  const handleApplyBan = async () => {
    if (!selectedUser || !banReason.trim() || !user) {
      toast({
        title: "Missing Information",
        description: "Please provide a ban reason",
        variant: "destructive"
      });
      return;
    }

    setIsUpdating(`ban-${selectedUser.id}`);
    
    try {
      const isPermanent = banDuration === 'permanent';
      const durationHours = isPermanent ? null : parseInt(banDuration);
      
      const banData: any = {
        user_id: selectedUser.id,
        ban_type: isPermanent ? 'permanent' : 'temporary',
        reason: banReason.trim(),
        admin_id: user.id,
        is_active: true,
        duration: isPermanent ? null : `${durationHours} hours`,
        expires_at: isPermanent 
          ? null 
          : new Date(Date.now() + durationHours! * 60 * 60 * 1000).toISOString()
      };

      const { error } = await supabase
        .from('user_bans')
        .insert(banData);

      if (error) throw error;

      toast({ 
        title: "Ban Applied",
        description: isPermanent 
          ? "User permanently banned" 
          : `User banned for ${durationHours} hours` 
      });

      setBanDialogOpen(false);
      setBanReason('');
      setBanDuration('24');
      
      await Promise.all([
        fetchUserBans(),
        fetchUserDetails(selectedUser.id)
      ]);
      
    } catch (error: any) {
      console.error('Error applying ban:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to apply ban",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const sendMessage = async (approachId: string) => {
    const text = (newMessage[approachId] || '').trim();
    if (!text) {
      toast({ title: "Empty", description: "Type a message first", variant: "destructive" });
      return;
    }

    setNewMessage(prev => ({ ...prev, [approachId]: '' }));

    const { error } = await supabase
      .from('approach_messages')
      .insert({
        approach_id: approachId,
        sender_id: user!.id,
        message: text,
      });

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      setNewMessage(prev => ({ ...prev, [approachId]: text }));
    } else {
      await supabase
        .from('direct_approaches')
        .update({ status: 'in_progress' })
        .eq('id', approachId)
        .eq('status', 'open');

      toast({ title: "Sent!" });
    }
  };

  const markAsResolved = async (approachId: string) => {
    setIsUpdating(approachId);
    const { error } = await supabase
      .from('direct_approaches')
      .update({ status: 'resolved' })
      .eq('id', approachId);

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Resolved", description: "Request closed." });
    setIsUpdating(null);
  };

  const approvePost = async (id: string) => {
    setIsUpdating(id);
    await supabase.from('posts').update({ status: 'approved' }).eq('id', id);
    toast({ title: "Approved" });
    setIsUpdating(null);
  };

  const rejectPost = async (id: string) => {
    setIsUpdating(id);
    await supabase.from('posts').update({ status: 'rejected' }).eq('id', id);
    toast({ title: "Rejected" });
    setIsUpdating(null);
  };

  // Auto-scroll when new message
  useEffect(() => {
    Object.keys(scrollRefs.current).forEach(id => {
      const el = scrollRefs.current[id];
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [messages]);

  const filteredReports = taskReports.filter(report => {
    if (reportFilter === 'all') return true;
    return report.status === reportFilter;
  });

  const filteredBans = userBans.filter(ban => {
    if (banFilter === 'all') return true;
    if (banFilter === 'active') return ban.is_active;
    if (banFilter === 'expired') return !ban.is_active || (ban.expires_at && new Date(ban.expires_at) < new Date());
    return true;
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!isUserAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 pb-24">
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-[#2ec2b3]">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Logged in as: {user?.email}</p>
          </div>
          <Badge variant="default" className="bg-[#2ec2b3] hover:bg-[#28a399]">
            <Shield className="h-4 w-4 mr-1" /> Admin
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="text-3xl font-bold text-primary">{adminStats.totalUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Reported Users</p>
              <p className="text-3xl font-bold text-orange-600">{adminStats.reportedUsers}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Tasks</p>
              <p className="text-3xl font-bold text-blue-500">{adminStats.activeTasks}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Posts</p>
              <p className="text-3xl font-bold text-blue-600">{adminStats.pendingPosts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Requests</p>
              <p className="text-3xl font-bold text-purple-600">{adminStats.activeRequests}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pending Reports</p>
              <p className="text-3xl font-bold text-red-600">{adminStats.pendingReports}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Bans</p>
              <p className="text-3xl font-bold text-red-800">{adminStats.activeBans}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="reports" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="reports">
              <Flag className="h-4 w-4 mr-2" />
              Reports ({taskReports.filter(r => r.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="bans">
              <UserX className="h-4 w-4 mr-2" />
              Bans ({userBans.filter(b => b.is_active).length})
            </TabsTrigger>
            <TabsTrigger value="posts">
              <ClipboardList className="h-4 w-4 mr-2" />
              Posts ({pendingPosts.length})
            </TabsTrigger>
            <TabsTrigger value="approaches">
              <Users className="h-4 w-4 mr-2" />
              Requests ({approaches.length})
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Select value={reportFilter} onValueChange={(value: any) => setReportFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reports</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="reviewing">Under Review</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Showing {filteredReports.length} of {taskReports.length} reports
              </p>
            </div>

            {filteredReports.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Flag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  No reports found
                </CardContent>
              </Card>
            ) : (
              filteredReports.map(report => (
                <Card key={report.id} className="border-l-4" style={{ 
                  borderLeftColor: 
                    report.severity === 'critical' ? '#dc2626' :
                    report.severity === 'high' ? '#ea580c' :
                    report.severity === 'medium' ? '#ca8a04' : '#16a34a'
                }}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {report.task?.title || 'Unknown Task'}
                          <Badge variant={
                            report.severity === 'critical' ? 'destructive' :
                            report.severity === 'high' ? 'destructive' :
                            report.severity === 'medium' ? 'secondary' : 'outline'
                          }>
                            {report.severity}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span>Reported by <strong>{report.reporter?.full_name}</strong></span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => report.reporter_id && fetchUserDetails(report.reporter_id)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span>Against <strong>{report.reported_user?.full_name}</strong></span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => fetchUserDetails(report.reported_user_id)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            {report.reported_user?.is_admin && (
                              <Badge variant="outline" className="ml-2">Admin</Badge>
                            )}
                          </div>
                          <div>
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                          </div>
                        </CardDescription>
                      </div>
                      <Badge variant={
                        report.status === 'pending' ? 'outline' :
                        report.status === 'reviewing' ? 'secondary' :
                        report.status === 'resolved' ? 'default' : 'destructive'
                      }>
                        {report.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-1">Report Reason:</p>
                      <p className="whitespace-pre-wrap">{report.reason}</p>
                    </div>

                    {report.admin_notes && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium mb-1 text-blue-700">Admin Notes:</p>
                        <p className="text-sm whitespace-pre-wrap">{report.admin_notes}</p>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Admin Notes (Optional)</label>
                        <Textarea
                          placeholder="Add notes about this report..."
                          value={reportNotes[report.id] || ''}
                          onChange={(e) => setReportNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                          className="min-h-20"
                        />
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium mb-1 block">Severity</label>
                        <Select
                          value={reportSeverity[report.id] || report.severity}
                          onValueChange={(value) => setReportSeverity(prev => ({ ...prev, [report.id]: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select severity" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      {report.status === 'pending' && (
                        <>
                          <Button 
                            onClick={() => handleUpdateReportStatus(report.id, 'reviewing', false)}
                            disabled={isUpdating === report.id}
                            variant="outline"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            {isUpdating === report.id ? 'Updating...' : 'Mark for Review'}
                          </Button>
                          <Button 
                            onClick={() => handleUpdateReportStatus(report.id, 'resolved', true)}
                            disabled={isUpdating === report.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            {isUpdating === report.id ? 'Updating...' : 'Valid Report'}
                          </Button>
                          <Button 
                            onClick={() => handleUpdateReportStatus(report.id, 'dismissed', false)}
                            disabled={isUpdating === report.id}
                            variant="destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            {isUpdating === report.id ? 'Updating...' : 'Dismiss Report'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchUserDetails(report.reported_user_id)}
                            className="ml-auto"
                          >
                            <User className="h-4 w-4 mr-2" />
                            View User
                          </Button>
                        </>
                      )}
                      
                      {report.status === 'reviewing' && (
                        <>
                          <Button 
                            onClick={() => handleUpdateReportStatus(report.id, 'resolved', true)}
                            disabled={isUpdating === report.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            {isUpdating === report.id ? 'Updating...' : 'Confirm Valid'}
                          </Button>
                          <Button 
                            onClick={() => handleUpdateReportStatus(report.id, 'dismissed', false)}
                            disabled={isUpdating === report.id}
                            variant="destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            {isUpdating === report.id ? 'Updating...' : 'Dismiss Report'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchUserDetails(report.reported_user_id)}
                            className="ml-auto"
                          >
                            <User className="h-4 w-4 mr-2" />
                            View User
                          </Button>
                        </>
                      )}
                      
                      {(report.status === 'resolved' || report.status === 'dismissed') && (
                        <div className="w-full flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Report {report.status} on {report.resolved_at ? 
                              new Date(report.resolved_at).toLocaleDateString() : 'N/A'}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchUserDetails(report.reported_user_id)}
                          >
                            <User className="h-4 w-4 mr-2" />
                            View User
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Bans Tab */}
          <TabsContent value="bans" className="mt-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Select value={banFilter} onValueChange={(value: any) => setBanFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter bans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bans</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="expired">Expired/Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredBans.filter(b => b.is_active).length} active bans
              </p>
            </div>

            {filteredBans.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  No bans found
                </CardContent>
              </Card>
            ) : (
              filteredBans.map(ban => (
                <Card key={ban.id} className={ban.is_active ? "border-l-4 border-red-500" : ""}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {ban.user?.full_name || 'Unknown User'}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => fetchUserDetails(ban.user_id)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </CardTitle>
                        <CardDescription>
                          {ban.user?.email} · {ban.ban_type} ban ·{' '}
                          {formatDistanceToNow(new Date(ban.created_at), { addSuffix: true })}
                        </CardDescription>
                      </div>
                      <Badge variant={ban.is_active ? "destructive" : "outline"}>
                        {ban.is_active ? 'Active' : 'Inactive'}
                        {ban.expires_at && ` (expires ${formatDistanceToNow(new Date(ban.expires_at), { addSuffix: true })})`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">
                        <strong>Reason:</strong> {ban.reason}
                      </p>
                      {ban.duration && (
                        <p className="text-sm">
                          <strong>Duration:</strong> {ban.duration}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-3 pt-4 border-t">
                        {ban.is_active ? (
                          <Button
                            onClick={() => handleManageBan(ban.id, 'deactivate')}
                            disabled={isUpdating === ban.id}
                            variant="outline"
                            size="sm"
                          >
                            Deactivate Ban
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleManageBan(ban.id, 'activate')}
                            disabled={isUpdating === ban.id}
                            variant="outline"
                            size="sm"
                          >
                            Reactivate Ban
                          </Button>
                        )}
                        
                        <Button
                          onClick={() => handleManageBan(ban.id, 'delete')}
                          disabled={isUpdating === ban.id}
                          variant="destructive"
                          size="sm"
                        >
                          Remove Ban
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchUserDetails(ban.user_id)}
                          className="ml-auto"
                        >
                          <User className="h-4 w-4 mr-2" />
                          View User
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-6 space-y-4">
            {pendingPosts.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No pending posts</CardContent></Card>
            ) : (
              pendingPosts.map(post => (
                <Card key={post.id}>
                  <CardHeader>
                    <p className="font-medium">{post.profiles.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
                    <div className="flex gap-3">
                      <Button onClick={() => approvePost(post.id)} disabled={isUpdating === post.id}>
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="destructive" onClick={() => rejectPost(post.id)} disabled={isUpdating === post.id}>
                        <X className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Approaches Tab */}
          <TabsContent value="approaches" className="mt-6 space-y-6">
            {approaches.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">No active requests</CardContent></Card>
            ) : (
              approaches.map(approach => {
                const chat = messages[approach.id] || [];

                return (
                  <Card key={approach.id} className="overflow-hidden">
                    <CardHeader className="bg-muted/40">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold">{approach.subject}</h3>
                          <p className="text-sm text-muted-foreground">
                            {approach.profiles.full_name} · {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {approach.status === 'in_progress' && (
                          <Button
                            size="sm"
                            onClick={() => markAsResolved(approach.id)}
                            disabled={isUpdating === approach.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-0">
                      <div className="border-b p-6">
                        <p className="mb-2 text-sm font-medium text-muted-foreground">Original Request:</p>
                        <p className="whitespace-pre-wrap">{approach.message}</p>
                      </div>

                      <ScrollArea className="h-96 px-6 py-4" ref={el => (scrollRefs.current[approach.id] = el)}>
                        {chat.length === 0 ? (
                          <p className="text-center text-muted-foreground">Start the conversation...</p>
                        ) : (
                          <div className="space-y-4">
                            {chat.map(msg => (
                              <div
                                key={msg.id}
                                className={`flex gap-3 ${msg.sender_id === user?.id ? 'flex-row-reverse' : ''}`}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {msg.sender_name?.[0] || (msg.sender_id === user?.id ? 'A' : 'R')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`flex max-w-md flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
                                  <p className="text-xs text-muted-foreground">
                                    {msg.sender_name || (msg.sender_id === user?.id ? 'You' : 'Resident')}
                                  </p>
                                  <div className={`mt-1 rounded-2xl px-4 py-2 ${msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-muted'}`}>
                                    <p className="text-sm">{msg.message}</p>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(msg.created_at))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>

                      <div className="border-t p-4">
                        <div className="flex gap-3">
                          <Textarea
                            placeholder="Type your reply..."
                            value={newMessage[approach.id] || ''}
                            onChange={e => setNewMessage(prev => ({ ...prev, [approach.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage(approach.id);
                              }
                            }}
                            className="min-h-20 resize-none"
                          />
                          <Button onClick={() => sendMessage(approach.id)} size="lg">
                            <Send className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* User Details Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Details: {selectedUser.full_name}
                </DialogTitle>
                <DialogDescription>
                  {selectedUser.email} · Joined {formatDistanceToNow(new Date(selectedUser.created_at), { addSuffix: true })}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Info */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>User Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="font-medium">{selectedUser.full_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Admin Status</p>
                      <Badge variant={selectedUser.is_admin ? "default" : "outline"}>
                        {selectedUser.is_admin ? "Admin" : "Regular User"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Account Created</p>
                      <p className="font-medium">
                        {new Date(selectedUser.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Reports History */}
                <Card className="md:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Report History</CardTitle>
                    <Badge variant="outline">{userReports.length} reports</Badge>
                  </CardHeader>
                  <CardContent>
                    {userReports.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No reports against this user</p>
                    ) : (
                      <ScrollArea className="h-64">
                        <div className="space-y-3">
                          {userReports.map(report => (
                            <div key={report.id} className="p-3 border rounded-lg">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{report.reporter_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                                  </p>
                                </div>
                                <Badge variant={
                                  report.status === 'resolved' ? 'default' :
                                  report.status === 'pending' ? 'outline' :
                                  report.status === 'reviewing' ? 'secondary' : 'destructive'
                                }>
                                  {report.status}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm line-clamp-2">{report.reason}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>

                {/* Ban History */}
                <Card className="md:col-span-3">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Ban History</CardTitle>
                      <CardDescription>Active bans: {userBansList.filter(b => b.is_active).length}</CardDescription>
                    </div>
                    <DialogTrigger asChild>
                      <Button onClick={() => setBanDialogOpen(true)}>
                        <Ban className="h-4 w-4 mr-2" />
                        Apply New Ban
                      </Button>
                    </DialogTrigger>
                  </CardHeader>
                  <CardContent>
                    {userBansList.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No bans for this user</p>
                    ) : (
                      <div className="space-y-3">
                        {userBansList.map(ban => (
                          <div key={ban.id} className={`p-3 border rounded-lg ${ban.is_active ? 'border-red-200 bg-red-50' : ''}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{ban.ban_type}</p>
                                <p className="text-sm text-muted-foreground">
                                  {formatDistanceToNow(new Date(ban.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <Badge variant={ban.is_active ? "destructive" : "outline"}>
                                {ban.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm"><strong>Reason:</strong> {ban.reason}</p>
                            {ban.duration && (
                              <p className="text-sm"><strong>Duration:</strong> {ban.duration}</p>
                            )}
                            {ban.expires_at && (
                              <p className="text-sm">
                                <strong>Expires:</strong> {formatDistanceToNow(new Date(ban.expires_at), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setUserDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Apply Ban Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Ban to {selectedUser?.full_name}</AlertDialogTitle>
            <AlertDialogDescription>
              This will restrict the user's ability to post tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="ban-reason">Ban Reason</Label>
              <Input
                id="ban-reason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for banning..."
              />
            </div>
            <div>
              <Label htmlFor="ban-duration">Duration (hours)</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 hours (1 day)</SelectItem>
                  <SelectItem value="168">168 hours (1 week)</SelectItem>
                  <SelectItem value="720">720 hours (30 days)</SelectItem>
                  <SelectItem value="8760">8760 hours (1 year)</SelectItem>
                  <SelectItem value="permanent">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setBanDialogOpen(false);
              setBanReason('');
              setBanDuration('24');
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleApplyBan} 
              disabled={!banReason.trim() || isUpdating?.startsWith('ban-')}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdating?.startsWith('ban-') ? 'Applying...' : 'Apply Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;