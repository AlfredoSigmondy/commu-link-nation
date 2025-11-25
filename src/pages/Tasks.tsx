import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, MapPin, DollarSign, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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
  profiles: {
    full_name: string;
  };
}

const Tasks = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      getUserLocation();
      fetchTasks();

      const channel = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
          fetchTasks();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast({
            title: 'Location Error',
            description: 'Could not get your location. You can still view all tasks.',
            variant: 'destructive',
          });
        }
      );
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles!tasks_creator_id_fkey (
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      return;
    }

    // Filter tasks within 50 meters if user location is available
    let filteredTasks = data as Task[];
    if (userLocation) {
      filteredTasks = data.filter((task: Task) => {
        if (!task.location_lat || !task.location_lng) return true;
        const distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          task.location_lat,
          task.location_lng
        );
        return distance <= 50; // 50 meters
      });
    }

    setTasks(filteredTasks);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsCreating(true);

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const paymentAmount = formData.get('payment') as string;
    const locationAddress = formData.get('location') as string;

    try {
      const { error } = await supabase.from('tasks').insert({
        creator_id: user?.id,
        title,
        description,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        location_address: locationAddress,
        location_lat: userLocation?.lat,
        location_lng: userLocation?.lng,
        status: 'open',
      });

      if (error) throw error;

      toast({
        title: 'Task created!',
        description: 'Your task has been posted to the board.',
      });
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ accepted_by: user?.id, status: 'in_progress' })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task accepted!',
        description: 'You can now work on this task.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task completed!',
        description: 'Great work!',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Task Board</h1>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a New Task</DialogTitle>
                  <DialogDescription>
                    Post a task that others in your community can help with
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" required placeholder="e.g., Help move furniture" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      required
                      placeholder="Provide details about the task..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment">Payment Amount (₱)</Label>
                    <Input id="payment" name="payment" type="number" step="0.01" placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" name="location" placeholder="Your address" />
                  </div>
                  {userLocation && (
                    <p className="text-sm text-muted-foreground">
                      Your GPS location will be saved with this task for local filtering.
                    </p>
                  )}
                  <Button type="submit" disabled={isCreating} className="w-full">
                    {isCreating ? 'Creating...' : 'Create Task'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {!userLocation && (
          <Card className="mb-6 shadow-soft border-accent">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                <MapPin className="inline h-4 w-4 mr-2" />
                Location services are disabled. Enable location to see tasks within 50 meters.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.length === 0 ? (
            <Card className="col-span-full shadow-soft">
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No tasks available in your area</p>
              </CardContent>
            </Card>
          ) : (
            tasks.map((task) => (
              <Card key={task.id} className="shadow-soft hover:shadow-medium transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <CardDescription>
                    Posted by {task.profiles.full_name} •{' '}
                    {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{task.description}</p>
                  {task.payment_amount && (
                    <div className="flex items-center text-primary font-semibold">
                      <DollarSign className="h-4 w-4 mr-1" />₱{task.payment_amount.toFixed(2)}
                    </div>
                  )}
                  {task.location_address && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-1" />
                      {task.location_address}
                    </div>
                  )}
                  <div className="pt-2">
                    {task.status === 'open' && task.creator_id !== user.id && (
                      <Button onClick={() => handleAcceptTask(task.id)} className="w-full">
                        Accept Task
                      </Button>
                    )}
                    {task.status === 'in_progress' && task.accepted_by === user.id && (
                      <Button onClick={() => handleCompleteTask(task.id)} className="w-full">
                        <Check className="h-4 w-4 mr-2" />
                        Mark Complete
                      </Button>
                    )}
                    {task.status === 'completed' && (
                      <div className="text-center py-2 bg-primary/10 rounded text-primary font-medium">
                        Completed
                      </div>
                    )}
                    {task.creator_id === user.id && task.status === 'open' && (
                      <div className="text-center py-2 bg-muted rounded text-muted-foreground">
                        Your Task
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Tasks;
