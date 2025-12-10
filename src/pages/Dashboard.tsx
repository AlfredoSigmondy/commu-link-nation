import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTypewriter } from '@/hooks/useTypewriter';
import { Button } from '@/components/ui/button';
import { 
  LogOut, 
  Home, 
  ClipboardList, 
  MessageCircle, 
  Phone, 
  User,
  Users,
  Shield,
  Building2,
  Users2,
  UserCircle,
  Badge,
  Award,
  X
} from 'lucide-react';
import CommunityFeed from '@/components/dashboard/CommunityFeed';
import { SignOutDialog } from '@/components/SignOutDialog';
import { NotificationBell } from '@/components/NotificationBell';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Barangay Official Data Structure
const barangayOfficials = [
  {
    id: 1,
    name: "Kap. Adrian Catapang",
    position: "Barangay Captain",
    avatarColor: "bg-red-100 text-red-600",
    icon: Award,
    description: "Chief Executive Officer of the Barangay",
    responsibilities: [
      "Presides over Barangay Council meetings",
      "Enforces all laws and ordinances",
      "Supervises Barangay officials"
    ]
  },
  {
    id: 2,
    name: "Kag. Jemima Cruz",
    position: "Barangay Kagawad - Peace & Order",
    avatarColor: "bg-blue-100 text-blue-600",
    icon: Shield,
    description: "Chairperson on Peace and Order Committee",
    responsibilities: [
      "Maintains peace and order",
      "Coordinates with PNP",
      "Handles dispute resolutions"
    ]
  },
  {
    id: 3,
    name: "Kag. Kathriona Brul",
    position: "Barangay Kagawad - Education",
    avatarColor: "bg-green-100 text-green-600",
    icon: Users,
    description: "Chairperson on Education Committee",
    responsibilities: [
      "Oversees educational programs",
      "Coordinates with DepEd",
      "Manages scholarship programs"
    ]
  },
  {
    id: 4,
    name: "Kag. Lebron James",
    position: "Barangay Kagawad - Health",
    avatarColor: "bg-purple-100 text-purple-600",
    icon: UserCircle,
    description: "Chairperson on Health Committee",
    responsibilities: [
      "Supervises health center",
      "Coordinates vaccination programs",
      "Health emergency response"
    ]
  },
  {
    id: 5,
    name: "Kag. Stephen Curry",
    position: "Barangay Kagawad - Infrastructure",
    avatarColor: "bg-amber-100 text-amber-600",
    icon: Building2,
    description: "Chairperson on Public Works Committee",
    responsibilities: [
      "Infrastructure projects",
      "Road maintenance",
      "Public facilities"
    ]
  },
  {
    id: 6,
    name: "Sek. Mami Toni",
    position: "Barangay Secretary",
    avatarColor: "bg-cyan-100 text-cyan-600",
    icon: Badge,
    description: "Records and documentation officer",
    responsibilities: [
      "Keeps Barangay records",
      "Prepares minutes of meetings",
      "Issues certifications"
    ]
  },
  {
    id: 7,
    name: "Tes. Martin Rumwaldaz",
    position: "Barangay Treasurer",
    avatarColor: "bg-emerald-100 text-emerald-600",
    icon: Users2,
    description: "Financial officer of the Barangay",
    responsibilities: [
      "Manages Barangay funds",
      "Prepares financial reports",
      "Collects fees and taxes"
    ]
  }
];

const Dashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showOrgChart, setShowOrgChart] = useState(false);
  
  const greetingText = user?.user_metadata?.full_name || 'Friend';
  const animatedGreeting = useTypewriter({
    text: `${greetingText}!`,
    speed: 80,
    delayStart: 300,
    delayEnd: 3000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
          <p className="mt-3 text-[#2ec2b3] font-semibold text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard', active: true },
    { icon: ClipboardList, label: 'Tasks', path: '/tasks' },
    ...(!isAdmin ? [
      { icon: Users, label: 'Friends', path: '/friends' },
      { icon: MessageCircle, label: 'Messages', path: '/messages' },
      { icon: Phone, label: 'Contact', path: '/direct-approach' },
    ] : []),
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Top Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 sm:h-16">
            {/* Logo - Now Clickable */}
            <button 
              onClick={() => setShowOrgChart(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity active:scale-95 duration-200"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#2ec2b3] rounded-xl flex items-center justify-center group relative">
                <Home className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  View Organization Chart
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-[#2ec2b3] hidden sm:block">
                CommUnity
              </h1>
            </button>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant={item.active ? "default" : "ghost"}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    item.active
                      ? 'bg-[#2ec2b3] hover:bg-[#28b0a2] text-white shadow-lg'
                      : 'text-gray-700 hover:text-[#2ec2b3] hover:bg-teal-50'
                  }`}
                  onClick={() => item.path && navigate(item.path)}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              ))}

              {isAdmin && (
                <Button
                  variant="outline"
                  className="ml-2 border-[#2ec2b3] text-[#2ec2b3] hover:bg-teal-50"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}

              <NotificationBell />

              <Button
                variant="ghost"
                size="icon"
                className="ml-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                onClick={() => setShowSignOutDialog(true)}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </nav>

            {/* Mobile Nav - Icon Only */}
            <div className="md:hidden flex items-center gap-1">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setShowSignOutDialog(true)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around py-1 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[60px] ${
                item.active ? 'text-[#2ec2b3]' : 'text-gray-500'
              }`}
              onClick={() => item.path && navigate(item.path)}
            >
              <item.icon className={`h-5 w-5 ${item.active ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[60px] text-gray-500"
              onClick={() => navigate('/admin')}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </nav>

      {/* Barangay Organizational Chart Modal */}
      <Dialog open={showOrgChart} onOpenChange={setShowOrgChart}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 bg-white z-10 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Barangay Organizational Chart
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowOrgChart(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-gray-600 mt-1">
              Meet your barangay officials and their responsibilities
            </p>
          </DialogHeader>

          <div className="p-6">
            {/* Organization Tree */}
            <div className="relative">
              {/* Captain at the top */}
              <div className="flex justify-center mb-12">
                <div className="text-center">
                  <div className="mb-4 flex justify-center">
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-red-100 to-red-50 flex items-center justify-center">
                      <Award className="h-12 w-12 text-red-600" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Barangay Captain</h3>
                  <p className="text-lg font-semibold text-red-600">Kap. Adrian Catapang</p>
                  <p className="text-gray-600 mt-2 max-w-md mx-auto">
                    Chief Executive Officer and Presiding Officer of the Barangay Council
                  </p>
                </div>
              </div>

              {/* Connection lines */}
              <div className="absolute top-40 left-1/2 transform -translate-x-1/2 w-0.5 h-16 bg-gray-300"></div>

              {/* Council Members Row */}
              <div className="mb-8">
                <h4 className="text-center text-lg font-semibold text-gray-700 mb-8">
                  Barangay Council Members
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {barangayOfficials.slice(1).map((official) => {
                    const Icon = official.icon;
                    return (
                      <div key={official.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-start gap-4">
                          <div className={`${official.avatarColor} w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <Icon className="h-7 w-7" />
                          </div>
                          <div className="flex-1">
                            <h5 className="font-bold text-gray-900">{official.name}</h5>
                            <p className="text-sm font-medium text-[#2ec2b3]">{official.position}</p>
                            <p className="text-gray-600 text-sm mt-2">{official.description}</p>
                            
                            <div className="mt-4">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Responsibilities:</p>
                              <ul className="space-y-1">
                                {official.responsibilities.map((responsibility, index) => (
                                  <li key={index} className="flex items-start text-sm text-gray-600">
                                    <span className="text-[#2ec2b3] mr-2">•</span>
                                    {responsibility}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Organizational Structure Diagram */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <h4 className="text-center text-lg font-semibold text-gray-700 mb-6">
                  Organizational Structure
                </h4>
                <div className="relative bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6">
                  <div className="flex flex-col items-center">
                    {/* Level 1 - Captain */}
                    <div className="relative">
                      <div className="bg-white px-6 py-4 rounded-xl shadow-lg border-2 border-red-200">
                        <p className="font-bold text-gray-900">Barangay Captain</p>
                      </div>
                      {/* Arrow down */}
                      <div className="mx-auto w-0.5 h-8 bg-gray-400"></div>
                    </div>

                    {/* Level 2 - Council */}
                    <div className="mt-2">
                      <div className="bg-white px-6 py-4 rounded-xl shadow-md border border-gray-200">
                        <p className="font-bold text-gray-900">Barangay Council</p>
                      </div>
                      {/* Arrows to committees */}
                      <div className="flex justify-center mt-2">
                        <div className="w-0.5 h-8 bg-gray-400"></div>
                      </div>
                    </div>

                    {/* Level 3 - Committees */}
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {['Peace & Order', 'Education', 'Health', 'Infrastructure'].map((committee) => (
                        <div key={committee} className="bg-white px-4 py-3 rounded-lg shadow-sm border border-gray-100 text-center">
                          <p className="text-sm font-medium text-gray-700">{committee}</p>
                          <p className="text-xs text-gray-500">Committee</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="mt-12 bg-[#2ec2b3]/5 rounded-2xl p-6 border border-[#2ec2b3]/20">
                <h4 className="text-lg font-bold text-gray-900 mb-4 text-center">
                  Barangay Hall Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2ec2b3] text-white mb-3">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <h5 className="font-semibold text-gray-900">Location</h5>
                    <p className="text-gray-600">Brgy. CommUnity, City Proper</p>
                    <p className="text-gray-600">Open: 8:00 AM - 5:00 PM (Mon-Fri)</p>
                  </div>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2ec2b3] text-white mb-3">
                      <Phone className="h-6 w-6" />
                    </div>
                    <h5 className="font-semibold text-gray-900">Contact</h5>
                    <p className="text-gray-600">(02) 1234-5678</p>
                    <p className="text-gray-600">brgy.community@email.com </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t px-6 py-4">
            <Button
              onClick={() => setShowOrgChart(false)}
              className="w-full bg-[#2ec2b3] hover:bg-[#28a399]"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        {/* Welcome Hero */}
        <div className="mb-4 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#2ec2b3]/5 to-transparent pointer-events-none"></div>
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  Welcome back,
                </h2>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-[#2ec2b3] truncate h-[2em] flex items-center">
                  {animatedGreeting}
                  <span className="animate-pulse ml-1">|</span>
                </p>
                <p className="text-gray-500 text-sm sm:text-base mt-1 hidden sm:block">
                  Here's what's happening in your barangay today
                </p>
              </div>
              <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-[#2ec2b3] rounded-2xl flex items-center justify-center text-white text-2xl sm:text-4xl font-bold shadow-lg overflow-hidden flex-shrink-0">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.user_metadata?.full_name?.[0] || 'U'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Community Feed */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-[#2ec2b3] p-4 sm:p-6 text-white">
            <h3 className="text-lg sm:text-2xl font-bold">Community Feed</h3>
            <p className="mt-1 opacity-90 text-sm sm:text-base">
              Latest from your community
            </p>
          </div>
          <div className="p-3 sm:p-5 lg:p-6">
            <CommunityFeed />
          </div>
        </div>
      </main>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />
    </div>
  );
};

export default Dashboard;