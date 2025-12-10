import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, Plus, MapPin, PhilippinePeso, Check, Navigation, Star, 
  ClipboardList, Trash2, Locate, Eye, MessageCircle, Package, 
  ShoppingCart, Sparkles, Truck, Wrench, Laptop, PawPrint, 
  HelpCircle, Filter, ChevronDown, ChevronUp, Grid3x3, Flag, Ban 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TaskRatingDialog } from '@/components/TaskRatingDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TASK_CATEGORIES = [
  { id: 'delivery', name: 'Delivery', icon: Package, color: 'bg-orange-500' },
  { id: 'groceries', name: 'Groceries', icon: ShoppingCart, color: 'bg-green-500' },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles, color: 'bg-blue-500' },
  { id: 'moving', name: 'Moving Help', icon: Truck, color: 'bg-purple-500' },
  { id: 'assembly', name: 'Assembly', icon: Wrench, color: 'bg-yellow-600' },
  { id: 'tech', name: 'Tech Help', icon: Laptop, color: 'bg-indigo-500' },
  { id: 'pet', name: 'Pet Care', icon: PawPrint, color: 'bg-pink-500' },
  { id: 'other', name: 'Other', icon: HelpCircle, color: 'bg-gray-500' },
] as const;

const MOBILE_CATEGORIES = [
  { id: 'delivery', name: 'Delivery', icon: Package, color: 'bg-orange-500', shortName: 'Delivery' },
  { id: 'groceries', name: 'Groceries', icon: ShoppingCart, color: 'bg-green-500', shortName: 'Groceries' },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles, color: 'bg-blue-500', shortName: 'Clean' },
  { id: 'moving', name: 'Moving', icon: Truck, color: 'bg-purple-500', shortName: 'Moving' },
  { id: 'assembly', name: 'Assembly', icon: Wrench, color: 'bg-yellow-600', shortName: 'Assembly' },
  { id: 'tech', name: 'Tech', icon: Laptop, color: 'bg-indigo-500', shortName: 'Tech' },
  { id: 'pet', name: 'Pet Care', icon: PawPrint, color: 'bg-pink-500', shortName: 'Pet' },
  { id: 'other', name: 'Other', icon: HelpCircle, color: 'bg-gray-500', shortName: 'Other' },
] as const;

type CategoryId = typeof TASK_CATEGORIES[number]['id'];

interface Task {
  id: string;
  title: string;
  description: string;
  payment_amount: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  status: string;
  created_at: string;
  creator_id: string;
  accepted_by: string | null;
  profiles: { full_name: string };
  accepter?: { full_name: string } | null;
  category: CategoryId;
}

const TaskCard: React.FC<{ task: Task, isCreatorView: boolean }> = ({ task, isCreatorView }) => {
  return (
    <Card className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <CardHeader className="p-3">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm truncate">{task.title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isCreatorView ? `Accepted by: ${task.accepter?.full_name || 'N/A'}` : `Posted by: ${task.profiles.full_name}`}
            </CardDescription>
          </div>
          {task.status === 'open' && <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[10px] flex-shrink-0">Open</Badge>}
          {task.status === 'in_progress' && <Badge className="bg-yellow-100 text-yellow-800 text-[10px] flex-shrink-0">In Progress</Badge>}
          {task.status === 'pending_completion' && <Badge className="bg-purple-100 text-purple-800 text-[10px] flex-shrink-0">Pending Review</Badge>}
          {task.status === 'completed' && <Badge className="bg-green-100 text-green-800 text-[10px] flex-shrink-0">Completed</Badge>}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <div className="flex items-center">
            <MapPin className="h-3 w-3 mr-1" /> Nearby
          </div>
          {task.payment_amount && (
            <div className="flex items-center font-bold text-[#2ec2b3] text-xs">
              ₱{task.payment_amount.toFixed(2)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Tasks = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [taskToRate, setTaskToRate] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [taskToReport, setTaskToReport] = useState<Task | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | 'all'>('all');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [banInfo, setBanInfo] = useState<{is_banned: boolean, reason: string, expires_at: string | null}>({
    is_banned: false,
    reason: '',
    expires_at: null
  });

  // Get ban details function
  const getBanDetails = async (): Promise<{is_banned: boolean, reason: string, expires_at: string | null}> => {
    if (!user) return { is_banned: false, reason: '', expires_at: null };
    
    try {
      const { data, error } = await supabase
        .from('user_bans')
        .select('reason, expires_at, created_at')
        .eq('user_id', user.id)
        .eq('ban_type', 'posting_restriction')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        // No active ban found
        return { is_banned: false, reason: '', expires_at: null };
      }
      
      // Check if ban is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Update ban to inactive since it's expired
        await supabase
          .from('user_bans')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('ban_type', 'posting_restriction')
          .eq('is_active', true);
        return { is_banned: false, reason: '', expires_at: null };
      }
      
      return { 
        is_banned: true, 
        reason: data.reason, 
        expires_at: data.expires_at 
      };
    } catch (error) {
      console.error('Error getting ban details:', error);
      return { is_banned: false, reason: '', expires_at: null };
    }
  };

  // Check ban status function
  const checkBanStatus = async () => {
    if (!user) return;
    const details = await getBanDetails();
    setBanInfo(details);
  };

  // Check user session
  useEffect(() => {
    const checkSession = async () => {
      if (user) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.log('No valid session, redirecting to login');
          navigate('/auth');
        }
      }
    };
    
    if (user) {
      checkSession();
    }
  }, [user, navigate]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (token) mapboxgl.accessToken = token;
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  // FIX 1: Ban Status Check - Should refresh periodically
  useEffect(() => {
    if (!user) return;
    
    // Initial check
    checkBanStatus();
    
    // Check ban status every minute
    const interval = setInterval(() => {
      checkBanStatus();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) {
      getUserLocation();
      fetchTasks();

      const channel = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const getUserLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(location);
        toast({ title: "Location updated", description: "Ready to post tasks!" });
      },
      () => {
        toast({ title: "Location denied", description: "Enable to use your current location", variant: "destructive" });
      },
      { enableHighAccuracy: true }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchTasks = async () => {
    setIsLoadingTasks(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_creator_id_fkey (full_name)
        `)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const tasksWithAccepters = await Promise.all(
        (data as Task[]).map(async (task) => {
          if (task.accepted_by) {
            const { data: accepterData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', task.accepted_by)
              .single();
            return { ...task, accepter: accepterData };
          }
          return task;
        })
      );

      let filtered = tasksWithAccepters;
      if (userLocation) {
        filtered = tasksWithAccepters.filter((task: Task) => {
          if (!task.location_lat || !task.location_lng) return true;
          const distance = calculateDistance(
            userLocation.lat,
            userLocation.lng,
            task.location_lat,
            task.location_lng
          );
          return distance <= 5_000; // 5km radius
        });
      }

      setTasks(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Get category icon
  const getCategoryIcon = (categoryId: CategoryId) => {
    const category = TASK_CATEGORIES.find(cat => cat.id === categoryId);
    const IconComponent = category?.icon || HelpCircle;
    return <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4" />;
  };

  // Get category color
  const getCategoryColor = (categoryId: CategoryId) => {
    const category = TASK_CATEGORIES.find(cat => cat.id === categoryId);
    return category?.color || 'bg-gray-500';
  };

  // Get filtered tasks based on selected category
  const getFilteredTasks = () => {
    if (selectedCategory === 'all') return tasks;
    return tasks.filter(task => task.category === selectedCategory);
  };

  const getMyCreatedTasks = (): Task[] => {
    if (!user) return [];
    return tasks
      .filter(task => task.creator_id === user.id && task.status !== 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getMyAcceptedTasks = (): Task[] => {
    if (!user) return [];
    return tasks
      .filter(task => task.accepted_by === user.id && task.status !== 'completed')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // FIX 2: Create Task Handler - Ban check should be async and await
  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // AWAIT the ban check before proceeding
    const currentBanStatus = await getBanDetails();
    
    if (currentBanStatus.is_banned) {
      let message = `You are banned from posting tasks: ${currentBanStatus.reason}`;
      if (currentBanStatus.expires_at) {
        const expiresDate = new Date(currentBanStatus.expires_at);
        const timeLeft = formatDistanceToNow(expiresDate, { addSuffix: false });
        message += `\nBan expires in ${timeLeft}`;
      } else {
        message += "\nThis is a permanent ban.";
      }
      
      toast({
        title: "Posting Restricted",
        description: message,
        variant: "destructive",
        duration: 10000
      });
      return;
    }
    
    if (!userLocation) {
      toast({ 
        title: "Location needed", 
        description: "Please allow location access first", 
        variant: "destructive" 
      });
      return;
    }

    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const paymentAmount = formData.get('payment') as string;
    const category = formData.get('category') as CategoryId;

    try {
      const { error } = await supabase.from('tasks').insert({
        creator_id: user?.id,
        title,
        description,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        location_lat: userLocation.lat,
        location_lng: userLocation.lng,
        location_address: "My current location",
        status: 'open',
        category: category || 'other',
      });

      if (error) throw error;

      toast({ title: "Task posted!", description: "Live in your area" });
      setDialogOpen(false);
      // Reset form
      e.currentTarget.reset();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id)
        .eq('creator_id', user?.id);

      if (error) throw error;

      toast({ title: "Task deleted", description: "Removed from the board" });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // FIX 4: Report Handler - Better error handling
  const handleReportTask = async () => {
    if (!taskToReport || !reportReason.trim() || !user) {
      toast({
        title: "Missing information",
        description: "Please provide a reason for reporting.",
        variant: "destructive"
      });
      return;
    }

    setIsReporting(true);
    try {
      const reportData = {
        task_id: taskToReport.id,
        reporter_id: user.id,
        reported_user_id: taskToReport.creator_id,
        reason: reportReason.trim(),
        status: 'pending' as const,
        severity: 'medium' as const
      };

      const { error } = await supabase
        .from('task_reports')
        .insert(reportData);

      if (error) {
        console.error('Report submission error:', error);
        
        // Check for duplicate report
        if (error.code === '23505') {
          toast({
            title: "Already Reported",
            description: "You've already reported this task.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Submission Failed",
            description: error.message || "Could not submit report.",
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "✓ Report Submitted",
        description: "Thank you for helping keep the community safe.",
      });
      
      setReportDialogOpen(false);
      setTaskToReport(null);
      setReportReason('');
      
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast({
        title: "Unexpected Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsReporting(false);
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ accepted_by: user?.id, status: 'in_progress' })
        .eq('id', taskId);
      if (error) throw error;
      toast({ title: "Task accepted!" });
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      if (task.accepted_by === user?.id) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'pending_completion' })
          .eq('id', taskId);
        if (error) throw error;
        toast({ title: "Submitted for review", description: "Waiting for creator confirmation" });
      } else if (task.creator_id === user?.id) {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
        if (error) throw error;
        toast({ title: "Task completed!" });

        if (task.accepted_by) {
          setTaskToRate(task);
          setRatingDialogOpen(true);
        }
      }
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!taskToRate?.accepted_by) return;
    try {
      const { error } = await supabase.from('task_ratings').insert({
        task_id: taskToRate.id,
        rated_user_id: taskToRate.accepted_by,
        rater_id: user?.id,
        rating,
        comment: comment || null,
      });
      if (error) throw error;
      toast({ title: "Thank you!", description: "Rating submitted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // FIX 3: Message User - Better duplicate handling
  const handleMessageUser = async (userId: string) => {
    if (!user || userId === user.id) return;

    try {
      // Check for existing friendship in BOTH directions
      const { data: existingFriendship, error: checkError } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingFriendship) {
        // Friendship exists, go to messages
        navigate('/messages', { state: { selectedUserId: userId } });
        return;
      }

      // Create new friendship with both directions to prevent race conditions
      const { error: insertError } = await supabase
        .from('friendships')
        .upsert(
          [
            {
              user_id: user.id,
              friend_id: userId,
              status: 'accepted',
            }
          ],
          { 
            onConflict: 'user_id,friend_id',
            ignoreDuplicates: true 
          }
        );

      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }

      toast({
        title: "Connected!",
        description: "You can now message this user",
      });

      navigate('/messages', { state: { selectedUserId: userId } });
    } catch (error: any) {
      console.error('Message user error:', error);
      toast({
        title: "Error",
        description: "Could not start chat. Try again.",
        variant: "destructive",
      });
    }
  };

  const openTaskMap = (task: Task) => {
    if (!task.location_lat || !task.location_lng) return;
    setSelectedTask(task);
    setMapDialogOpen(true);

    setTimeout(() => {
      if (!mapContainer.current) return;
      if (map.current) map.current.remove();

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [task.location_lng!, task.location_lat!],
        zoom: 13,
      });

      // Task marker
      new mapboxgl.Marker({ color: '#dc2626' })
        .setLngLat([task.location_lng!, task.location_lat!])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <h3 class="font-bold text-lg">${task.title}</h3>
            <p class="text-sm text-gray-600">${task.description}</p>
          `)
        )
        .addTo(map.current!)
        .togglePopup();

      // Your location
      if (userLocation) {
        new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(new mapboxgl.Popup().setHTML('<p class="font-medium text-blue-600">You are here</p>'))
          .addTo(map.current!);
      }

      // 5KM RADIUS CIRCLE
      map.current.on('load', () => {
        map.current!.addSource('radius', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [task.location_lng!, task.location_lat!],
            },
          },
        });

        map.current!.addLayer({
          id: 'radius-circle',
          type: 'circle',
          source: 'radius',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 1000,   // at zoom 10 → ~1km visible
              15, 5000    // at zoom 15 → full 5km
            ],
            'circle-color': '#2ec2b3',
            'circle-opacity': 0.15,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#2ec2b3',
            'circle-stroke-opacity': 0.6,
          },
        });

        // Fit map to show radius + your location
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([task.location_lng!, task.location_lat!]);

        if (userLocation) {
          bounds.extend([userLocation.lng, userLocation.lat]);
        }

        // Extend bounds to include 5km radius
        const radiusKm = 5;
        const earthRadius = 6371;
        const latOffset = (radiusKm / earthRadius) * (180 / Math.PI);
        const lngOffset = latOffset / Math.cos((task.location_lat! * Math.PI) / 180);

        bounds.extend([task.location_lng! + lngOffset, task.location_lat! + latOffset]);
        bounds.extend([task.location_lng! - lngOffset, task.location_lat! - latOffset]);

        map.current!.fitBounds(bounds, { padding: 80, duration: 1500 });
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }, 150);
  };

  const getDirections = (task: Task) => {
    if (!task.location_lat || !task.location_lng) return;
    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${task.location_lat},${task.location_lng}&travelmode=walking`
      : `https://www.google.com/maps/search/?api=1&query=${task.location_lat},${task.location_lng}`;
    window.open(url, '_blank');
  };

  // Ban Status Checker Component
  const BanStatusChecker = () => {
    useEffect(() => {
      const interval = setInterval(() => {
        checkBanStatus();
      }, 60000);
      return () => clearInterval(interval);
    }, []);

    if (!banInfo.is_banned) return null;

    return (
      <Card className="mb-4 sm:mb-6 border-red-200 bg-red-50">
        <CardContent className="py-3 sm:py-4 flex items-center gap-3">
          <Ban className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-red-800">
              You are banned from posting tasks
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Reason: {banInfo.reason}
              {banInfo.expires_at && (
                <> • Expires: {formatDistanceToNow(new Date(banInfo.expires_at), { addSuffix: true })}</>
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2ec2b3] border-t-transparent"></div>
        <p className="mt-4 text-[#2ec2b3] font-semibold">Loading tasks...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
      {/* Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-teal-50 rounded-xl">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#2ec2b3] flex items-center gap-2 sm:gap-3">
                <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="hidden sm:inline">Task Board</span>
                <span className="sm:hidden">Tasks</span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-[#2ec2b3] border-[#2ec2b3] hover:bg-teal-50 rounded-xl shadow-sm text-sm sm:text-base">
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>My Task Activity</DialogTitle>
                    <DialogDescription>Your posted and accepted tasks.</DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-700">
                          <Plus className="h-4 w-4 text-[#2ec2b3]" />
                          Tasks I Created ({getMyCreatedTasks().length})
                        </h3>
                        <div className="grid gap-3">
                          {getMyCreatedTasks().length > 0 ? (
                            getMyCreatedTasks().map((task) => (
                              <TaskCard key={task.id} task={task} isCreatorView={true} />
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">You haven't posted any tasks yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="border-t pt-4"></div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-700">
                          <Check className="h-4 w-4 text-yellow-600" />
                          Tasks I Accepted ({getMyAcceptedTasks().length})
                        </h3>
                        <div className="grid gap-3">
                          {getMyAcceptedTasks().length > 0 ? (
                            getMyAcceptedTasks().map((task) => (
                              <TaskCard key={task.id} task={task} isCreatorView={false} />
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md">You haven't accepted any tasks yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2ec2b3] hover:bg-[#28a399] text-white rounded-xl shadow-lg text-sm sm:text-base">
                    <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Create Task</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>Post a task using your current location</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                    <div>
                      <Label>Title</Label>
                      <Input name="title" required placeholder="e.g., Help carry groceries" className="mt-1" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Textarea name="description" required placeholder="What needs to be done?" className="min-h-32 mt-1" />
                    </div>
                    
                    {/* Category Selection */}
                    <div>
                      <Label>Category</Label>
                      <Select name="category" required defaultValue="other">
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_CATEGORIES.map((category) => {
                            const IconComponent = category.icon;
                            return (
                              <SelectItem key={category.id} value={category.id}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="h-4 w-4" />
                                  <span>{category.name}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Payment <span className="text-gray-400 text-xs"></span></Label>
                      <Input name="payment" type="number" step="0.01" placeholder="₱ 100.00" className="mt-1" />
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                      <Locate className="h-6 w-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Using your current location</p>
                        <p className="text-xs text-green-600">Only people within 5km can see this task</p>
                      </div>
                    </div>

                    <Button type="submit" disabled={isCreating || !userLocation} className="w-full bg-[#2ec2b3] hover:bg-[#28a399]">
                      {isCreating ? 'Posting...' : 'Post Task Now'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {!userLocation && (
          <Card className="mb-4 sm:mb-6 border-orange-200 bg-orange-50">
            <CardContent className="py-3 sm:py-4 flex items-center gap-3">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-orange-800">Enable location to post & see tasks nearby (within 5km)</p>
            </CardContent>
          </Card>
        )}
        <BanStatusChecker />

        {/* Mobile-Adaptive Category Filter Section */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isMobileView ? (
                <Grid3x3 className="h-4 w-4 text-[#2ec2b3]" />
              ) : (
                <Filter className="h-4 w-4 text-[#2ec2b3]" />
              )}
              <h2 className="text-sm font-medium text-gray-700">
                {isMobileView ? 'Categories' : 'Filter by Category'}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className="text-xs h-8 gap-1"
            >
              {showCategoryFilter ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  <span className="hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span className="hidden sm:inline">Show</span>
                </>
              )}
            </Button>
          </div>
          
          {/* Mobile-Optimized Category Filters */}
          {showCategoryFilter && (
            <>
              {/* "All" Button - Always visible */}
              <div className="mb-3">
                <Button
                  variant={selectedCategory === 'all' ? 'default' : 'outline'}
                  size={isMobileView ? "sm" : "default"}
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full ${selectedCategory === 'all' ? 'bg-[#2ec2b3] hover:bg-[#28a399]' : ''}`}
                >
                  <span className="text-sm">All Tasks ({tasks.length})</span>
                </Button>
              </div>
              
              {/* Category Grid - Mobile optimized */}
              <div className={`grid ${isMobileView ? 'grid-cols-4 gap-2' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3'}`}>
                {MOBILE_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  const displayName = isMobileView ? category.shortName : category.name;
                  return (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? 'default' : 'outline'}
                      size={isMobileView ? "sm" : "default"}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`
                        flex flex-col items-center justify-center h-auto p-2 sm:p-3
                        ${selectedCategory === category.id ? 'bg-[#2ec2b3] hover:bg-[#28a399] border-[#2ec2b3]' : ''}
                        transition-all duration-200
                      `}
                    >
                      <div className={`${category.color} rounded-full p-2 mb-1 sm:mb-2`}>
                        <IconComponent className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5 sm:h-6 sm:w-6'} text-white`} />
                      </div>
                      <span className={`${isMobileView ? 'text-[10px] leading-tight' : 'text-xs sm:text-sm'} font-medium truncate w-full text-center`}>
                        {displayName}
                      </span>
                    </Button>
                  );
                })}
              </div>
              
              {/* Selected Category Badge */}
              {selectedCategory !== 'all' && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span>Showing:</span>
                    <Badge variant="outline" className="flex items-center gap-1 px-2 py-1">
                      {(() => {
                        const category = MOBILE_CATEGORIES.find(c => c.id === selectedCategory);
                        const IconComponent = category?.icon || HelpCircle;
                        return (
                          <>
                            <div className={`${category?.color} rounded-full p-1`}>
                              <IconComponent className="h-3 w-3 text-white" />
                            </div>
                            <span className="font-medium">{category?.name}</span>
                            <span className="ml-1 text-xs text-gray-500">({getFilteredTasks().length})</span>
                          </>
                        );
                      })()}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                    className="text-xs text-[#2ec2b3] hover:text-[#28a399]"
                  >
                    Clear filter
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-140px)] sm:h-[calc(100vh-180px)] pr-1 sm:pr-4">
          {isLoadingTasks ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2ec2b3] border-t-transparent mx-auto"></div>
                <p className="mt-4 text-[#2ec2b3] font-semibold">Loading tasks...</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {getFilteredTasks().length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 sm:py-20 text-center">
                    <ClipboardList className="h-14 w-14 sm:h-20 sm:w-20 mx-auto text-gray-300 mb-3" />
                    <p className="text-base sm:text-xl text-gray-600">
                      {selectedCategory === 'all' 
                        ? "No tasks nearby" 
                        : `No ${MOBILE_CATEGORIES.find(c => c.id === selectedCategory)?.name?.toLowerCase()} tasks nearby`}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">Be the first to post one!</p>
                  </CardContent>
                </Card>
              ) : (
                getFilteredTasks().map((task) => (
                  <Card key={task.id} className="shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-[#2ec2b3]/5 to-cyan-50 p-3 sm:p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${getCategoryColor(task.category)}`}>
                              {getCategoryIcon(task.category)}
                            </div>
                            <CardTitle className="text-base sm:text-lg truncate">{task.title}</CardTitle>
                          </div>
                          <CardDescription className="text-xs sm:text-sm mt-0.5">
                            by <strong className="truncate">{task.profiles.full_name}</strong> · {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                          </CardDescription>
                          {task.accepter && <p className="text-xs sm:text-sm text-[#2ec2b3] font-medium mt-1 truncate">Accepted by {task.accepter.full_name}</p>}
                        </div>
                        {task.status === 'in_progress' && <Badge className="bg-yellow-100 text-yellow-800 text-[10px] sm:text-xs flex-shrink-0">In Progress</Badge>}
                        {task.status === 'pending_completion' && <Badge className="bg-purple-100 text-purple-800 text-[10px] sm:text-xs flex-shrink-0">Pending Review</Badge>}
                        {task.status === 'completed' && <Badge className="bg-green-100 text-green-800 text-[10px] sm:text-xs flex-shrink-0">Completed</Badge>}
                      </div>
                    </CardHeader>

                    <CardContent className="p-3 sm:p-4 pt-3 space-y-3">
                      <p className="text-gray-700 leading-relaxed text-sm line-clamp-3">{task.description}</p>

                      {task.payment_amount && (
                        <div className="flex items-center font-bold text-[#2ec2b3] text-base sm:text-lg">
                          < PhilippinePeso className="h-4 w-4 sm:h-5 sm:w-5" />{task.payment_amount.toFixed(2)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600">
                        <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#2ec2b3]" />
                        <span>Nearby location</span>
                      </div>

                      {task.location_lat && task.location_lng && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openTaskMap(task)} className="flex-1 text-xs sm:text-sm h-8 sm:h-9">
                            <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Map
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => getDirections(task)} className="flex-1 text-xs sm:text-sm h-8 sm:h-9">
                            <Navigation className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Go
                          </Button>
                        </div>
                      )}

                      <div className="pt-3 border-t space-y-2">
                        {/* Report Button - Always visible for non-creators */}
                        {task.creator_id !== user.id && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => { setTaskToReport(task); setReportDialogOpen(true); }} 
                            className="w-full text-xs sm:text-sm h-8 sm:h-9 border-red-200 text-red-600 hover:bg-red-50"
                          >
                            <Flag className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Report Task
                          </Button>
                        )}

                        {task.creator_id === user.id && task.status === 'open' && (
                          <Button variant="destructive" size="sm" onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }} className="w-full text-xs sm:text-sm h-8 sm:h-9">
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Delete Task
                          </Button>
                        )}

                        {task.status === 'open' && task.creator_id !== user.id && (
                          <>
                            <Button onClick={() => handleAcceptTask(task.id)} className="w-full bg-[#2ec2b3] hover:bg-[#28a399] text-xs sm:text-sm h-8 sm:h-9">
                              Accept Task
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => handleMessageUser(task.creator_id)} 
                              className="w-full text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Poster
                            </Button>
                          </>
                        )}
                        
                        {task.status === 'in_progress' && task.accepted_by !== user.id && task.creator_id !== user.id && (
                          <div className="text-center py-2 bg-gray-100 rounded-lg text-gray-600 font-medium text-xs sm:text-sm">
                            Task Pending
                          </div>
                        )}
                        
                        {task.status === 'in_progress' && task.accepted_by === user.id && (
                          <>
                            <Button onClick={() => handleCompleteTask(task.id)} className="w-full bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9">
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Mark as Done
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => handleMessageUser(task.creator_id)} 
                              className="w-full text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Poster
                            </Button>
                          </>
                        )}
                        
                        {task.status === 'pending_completion' && task.accepted_by === user.id && (
                          <>
                            <div className="text-center py-2 bg-purple-50 rounded-lg text-purple-700 font-medium text-xs sm:text-sm">
                              Waiting for Confirmation
                            </div>
                            <Button 
                              variant="outline" 
                              onClick={() => handleMessageUser(task.creator_id)} 
                              className="w-full text-xs sm:text-sm h-8 sm:h-9"
                            >
                              <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Poster
                            </Button>
                          </>
                        )}
                        
                        {task.status === 'pending_completion' && task.creator_id === user.id && (
                          <>
                            <Button onClick={() => handleCompleteTask(task.id)} className="w-full bg-green-600 hover:bg-green-700 text-xs sm:text-sm h-8 sm:h-9">
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Confirm Completed
                            </Button>
                            {task.accepted_by && (
                              <Button 
                                variant="outline" 
                                onClick={() => handleMessageUser(task.accepted_by!)} 
                                className="w-full text-xs sm:text-sm h-8 sm:h-9"
                              >
                                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Worker
                              </Button>
                            )}
                          </>
                        )}
                        
                        {task.status === 'in_progress' && task.creator_id === user.id && (
                          <>
                            <div className="text-center py-2 bg-teal-50 rounded-lg text-[#2ec2b3] font-medium text-xs sm:text-sm">
                              In Progress - Waiting for Worker
                            </div>
                            {task.accepted_by && (
                              <Button 
                                variant="outline" 
                                onClick={() => handleMessageUser(task.accepted_by!)} 
                                className="w-full text-xs sm:text-sm h-8 sm:h-9"
                              >
                                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Worker
                              </Button>
                            )}
                          </>
                        )}
                        
                        {task.status === 'completed' && task.creator_id === user.id && (
                          <>
                            <Button variant="outline" onClick={() => { setTaskToRate(task); setRatingDialogOpen(true); }} className="w-full border-[#2ec2b3] text-[#2ec2b3] hover:bg-teal-50 text-xs sm:text-sm h-8 sm:h-9">
                              <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Rate Worker
                            </Button>
                            {task.accepted_by && (
                              <Button 
                                variant="outline" 
                                onClick={() => handleMessageUser(task.accepted_by!)} 
                                className="w-full text-xs sm:text-sm h-8 sm:h-9"
                              >
                                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" /> Message Worker
                              </Button>
                            )}
                          </>
                        )}
                        
                        {task.status === 'completed' && (
                          <div className="text-center py-2 bg-green-50 rounded-lg text-green-700 font-medium text-xs sm:text-sm">Task Completed</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </main>

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-50">
            <DialogTitle className="text-2xl">{selectedTask?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Nearby location
            </DialogDescription>
          </DialogHeader>
          <div ref={mapContainer} className="w-full h-96 md:h-[500px]" />
          <div className="p-4 bg-gray-50 border-t">
            <Button onClick={() => getDirections(selectedTask!)} className="w-full bg-[#2ec2b3] hover:bg-[#28a399]">
              <Navigation className="h-5 w-5 mr-2" />
              Get Walking Directions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Dialog */}
      <AlertDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report Inappropriate Task</AlertDialogTitle>
            <AlertDialogDescription>
              Please describe why you're reporting this task. Reports are anonymous and will be reviewed by our moderators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="e.g., Spam, inappropriate content, fake task, suspicious activity..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="min-h-32"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-2">
              Please be specific. Your report helps keep the community safe.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setReportDialogOpen(false);
              setReportReason('');
              setTaskToReport(null);
            }}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleReportTask} 
              disabled={!reportReason.trim() || isReporting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isReporting ? 'Submitting...' : 'Submit Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      {taskToRate && (
        <TaskRatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          onSubmit={handleSubmitRating}
          userName={taskToRate.accepter?.full_name || 'the helper'}
        />
      )}
    </div>
  );
};

export default Tasks;