import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Film, DollarSign, Clock, Plus, Check, X, Edit, BarChart3, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmModal } from '../components/ConfirmModal';
import { supabase, User, Content, PaymentRequest, StreamingPayment } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { PaymentHistoryTable } from '../components/PaymentHistoryTable';
import { PaymentUpload } from '../components/PaymentUpload';
import { UnassignedContentManager } from '../components/UnassignedContentManager';
import { PaymentHistoryAdmin } from '../components/PaymentHistoryAdmin';
import { FilmmakerViewAdmin } from '../components/FilmmakerViewAdmin';
import { BulkTitleImport } from '../components/BulkTitleImport';
import { AdminUserManagement } from '../components/AdminUserManagement';
import { FilmmakerUserManagement } from '../components/FilmmakerUserManagement';
import { TitleReassignment } from '../components/TitleReassignment';
import { PlatformSplitEditor, SplitRow } from '../components/PlatformSplitEditor';
import { AuditLog } from '../components/AuditLog';
import { TopTitlesLeaderboard } from '../components/TopTitlesLeaderboard';
import { FilmmakerSummaryReport } from '../components/FilmmakerSummaryReport';

interface AdminStats {
  totalUsers: number;
  totalTitles: number;
  totalRevenue: number;
  totalPaidToFilmmakers: number;
  companyProfit: number;
  pendingRequests: number;
}

interface CreateFilmmakerData {
  email: string;
  first_name: string;
  last_name: string;
}

export function AdminDashboard() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'titles' | 'financial' | 'payments' | 'filmmakers' | 'requests' | 'audit' | 'admins'>('overview');
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTitles: 0,
    totalRevenue: 0,
    totalPaidToFilmmakers: 0,
    companyProfit: 0,
    pendingRequests: 0,
  });
  const [filmmakers, setFilmmakers] = useState<User[]>([]);
  const [titles, setTitles] = useState<Content[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [streamingPayments, setStreamingPayments] = useState<StreamingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFilmmaker, setShowAddFilmmaker] = useState(false);
  const [showAddTitle, setShowAddTitle] = useState(false);
  const [showEditTitle, setShowEditTitle] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showPaymentUpload, setShowPaymentUpload] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showAssignFilmmaker, setShowAssignFilmmaker] = useState(false);
  const [assigningTitle, setAssigningTitle] = useState<Content | null>(null);
  const [selectedFilmmakerForAssign, setSelectedFilmmakerForAssign] = useState('');
  const [viewingFilmmaker, setViewingFilmmaker] = useState<User | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<PaymentRequest | null>(null);
  const [editingTitle, setEditingTitle] = useState<Content | null>(null);
  const [editTitleSplits, setEditTitleSplits] = useState<SplitRow[]>([{ platform: null, company: 25, filmmaker: 75 }]);
  const [newFilmmaker, setNewFilmmaker] = useState<CreateFilmmakerData>({
    email: '',
    first_name: '',
    last_name: '',
  });
  const [newTitle, setNewTitle] = useState({
    title_name: '',
    content_type: 'movie' as 'movie' | 'series' | 'episode',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
    filmmaker_id: '',
    distribution_percentage: '20',
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
  });
  const [editTitle, setEditTitle] = useState({
    title_name: '',
    content_type: 'movie' as 'movie' | 'series' | 'episode',
    description: '',
    genre: '',
    release_date: '',
    duration_minutes: '',
    rating: '',
    filmmaker_id: '',
    distribution_percentage: '25',
    previous_gross_amount: '',
    previous_expenses: '',
    previous_distribution_fee: '',
    previous_net_revenue: '',
    previous_amount_paid: '',
    previous_balance_due: '',
  });
  const [newPayment, setNewPayment] = useState({
    title_id: '',
    platform: '',
    outlet: '',
    payment_date: '',
    gross_amount: '',
    notes: '',
  });

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Button loading states
  const [savingFilmmaker, setSavingFilmmaker] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Pagination state
  const [titlesPage, setTitlesPage] = useState(1);
  const [filmmakersPage, setFilmmakersPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [titlesSearch, setTitlesSearch] = useState('');
  const [filmmakersSearch, setFilmmakersSearch] = useState('');
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const filmmakersData = usersData?.filter(user => user.role === 'filmmaker') || [];
      setFilmmakers(filmmakersData);

      const { data: titlesData, error: titlesError } = await supabase
        .from('content')
        .select(`
          *,
          filmmaker:users!content_filmmaker_id_fkey(first_name, last_name, email),
          title_distribution_settings(*)
        `)
        .order('title_name', { ascending: true });

      if (titlesError) throw titlesError;
      setTitles(titlesData || []);

      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select(`
          *,
          filmmaker:users!payment_requests_filmmaker_id_fkey(first_name, last_name, email),
          approver:users!payment_requests_approved_by_fkey(first_name, last_name, email)
        `)
        .order('requested_at', { ascending: false });

      if (requestsError) throw requestsError;
      setPaymentRequests(requestsData || []);

      // Fetch payments from the payments table in batches
      let allPayments: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('payments')
          .select(`
            *,
            content(title_name, filmmaker_id)
          `)
          .order('payment_date', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allPayments = [...allPayments, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const paymentsData = allPayments;

      // Transform payments to match StreamingPayment format
      const transformedPayments = (paymentsData || []).map(p => ({
        id: p.id,
        title_id: p.content_id,
        platform: p.channel || 'Payment',
        outlet: null,
        payment_date: p.payment_date,
        gross_amount: p.gross_amount || 0,
        net_amount: p.net_amount || 0,
        distribution_percentage: p.distribution_fee || 0,
        notes: p.notes,
        created_at: p.created_at,
        updated_at: p.updated_at,
        content: p.content,
        filmmaker_id: p.filmmaker_id
      }));

      setStreamingPayments(transformedPayments);

      // Calculate stats including historical data from content table
      // Only count positive amounts from payments table (revenue in, not withdrawals)
      const revenueFromPayments = (paymentsData || [])
        .filter(payment => (payment.gross_amount || 0) > 0)
        .reduce((sum, payment) => sum + (payment.gross_amount || 0), 0);

      // Add historical gross amounts from content table
      const historicalRevenue = (titlesData || []).reduce((sum, title) => sum + (title.previous_gross_amount || 0), 0);
      const totalRevenue = revenueFromPayments + historicalRevenue;

      // Calculate total paid including historical payments
      const paidViaRequests = (requestsData || [])
        .filter(req => req.status === 'paid')
        .reduce((sum, req) => sum + (req.amount_approved || req.amount_requested || 0), 0);

      const historicalPaid = (titlesData || []).reduce((sum, title) => sum + (title.previous_amount_paid || 0), 0);
      const totalPaidToFilmmakers = paidViaRequests + historicalPaid;

      const companyProfit = totalRevenue * 0.25;
      const pendingRequests = (requestsData || []).filter(req => req.status === 'pending').length;

      const calculatedStats = {
        totalUsers: filmmakersData.length,
        totalTitles: titlesData?.length || 0,
        totalRevenue,
        totalPaidToFilmmakers,
        companyProfit,
        pendingRequests,
      };

      setStats(calculatedStats);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFilmmaker = async () => {
    if (!newFilmmaker.email || !newFilmmaker.first_name || !newFilmmaker.last_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSavingFilmmaker(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-filmmaker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(newFilmmaker),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create filmmaker');
      }

      toast.success(`Filmmaker created! Temporary password: ${result.temporary_password}`);
      setNewFilmmaker({ email: '', first_name: '', last_name: '' });
      setShowAddFilmmaker(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(`Error creating filmmaker: ${error.message}`);
    } finally {
      setSavingFilmmaker(false);
    }
  };

  const handleCreateTitle = async () => {
    if (!newTitle.title_name || !newTitle.filmmaker_id) {
      toast.error('Please fill in title name and select a filmmaker');
      return;
    }

    setSavingTitle(true);
    try {
      const { data, error } = await supabase
        .from('content')
        .insert({
          title_name: newTitle.title_name,
          content_type: newTitle.content_type,
          description: newTitle.description || null,
          genre: newTitle.genre || null,
          release_date: newTitle.release_date || null,
          duration_minutes: newTitle.duration_minutes ? parseInt(newTitle.duration_minutes) : null,
          rating: newTitle.rating || null,
          filmmaker_id: newTitle.filmmaker_id,
          status: 'approved', // Admin-created titles are auto-approved
          previous_gross_amount: newTitle.previous_gross_amount ? parseFloat(newTitle.previous_gross_amount) : 0,
          previous_expenses: newTitle.previous_expenses ? parseFloat(newTitle.previous_expenses) : 0,
          previous_distribution_fee: newTitle.previous_distribution_fee ? parseFloat(newTitle.previous_distribution_fee) : 0,
          previous_net_revenue: newTitle.previous_net_revenue ? parseFloat(newTitle.previous_net_revenue) : 0,
          previous_amount_paid: newTitle.previous_amount_paid ? parseFloat(newTitle.previous_amount_paid) : 0,
          previous_balance_due: newTitle.previous_balance_due ? parseFloat(newTitle.previous_balance_due) : 0,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      const companyPercentage = newTitle.distribution_percentage ? parseFloat(newTitle.distribution_percentage) : 25;
      const filmmakerPercentage = 100 - companyPercentage;

      await supabase
        .from('title_distribution_settings')
        .insert({
          title_id: data.id,
          company_percentage: companyPercentage,
          filmmaker_percentage: filmmakerPercentage,
        });

      toast.success('Title created successfully!');
      setNewTitle({
        title_name: '',
        content_type: 'movie',
        description: '',
        genre: '',
        release_date: '',
        duration_minutes: '',
        rating: '',
        filmmaker_id: '',
        distribution_percentage: '25',
        previous_gross_amount: '',
        previous_expenses: '',
        previous_distribution_fee: '',
        previous_net_revenue: '',
        previous_amount_paid: '',
        previous_balance_due: '',
      });
      setShowAddTitle(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error creating title. Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleEditTitle = (title: Content) => {
    setEditingTitle(title);
    setEditTitle({
      title_name: title.title_name,
      content_type: title.content_type,
      description: title.description || '',
      genre: title.genre || '',
      release_date: title.release_date || '',
      duration_minutes: title.duration_minutes?.toString() || '',
      rating: title.rating || '',
      filmmaker_id: title.filmmaker_id || '',
      distribution_percentage: '25', // kept for add-title path only
      previous_gross_amount: title.previous_gross_amount?.toString() || '',
      previous_expenses: title.previous_expenses?.toString() || '',
      previous_distribution_fee: title.previous_distribution_fee?.toString() || '',
      previous_net_revenue: title.previous_net_revenue?.toString() || '',
      previous_amount_paid: title.previous_amount_paid?.toString() || '',
      previous_balance_due: title.previous_balance_due?.toString() || '',
    });

    // Build split rows from existing distribution settings
    const settings = title.title_distribution_settings ?? [];
    const globalRow = settings.find(s => !s.platform);
    const platformRows = settings.filter(s => !!s.platform);
    setEditTitleSplits([
      { platform: null, company: globalRow?.company_percentage ?? 25, filmmaker: globalRow?.filmmaker_percentage ?? 75 },
      ...platformRows.map(s => ({ platform: s.platform!, company: s.company_percentage, filmmaker: s.filmmaker_percentage })),
    ]);

    setShowEditTitle(true);
  };

  const handleUpdateTitle = async () => {
    if (!editingTitle || !editTitle.title_name || !editTitle.filmmaker_id) {
      toast.error('Please fill in title name and select a filmmaker');
      return;
    }

    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from('content')
        .update({
          title_name: editTitle.title_name,
          content_type: editTitle.content_type,
          description: editTitle.description || null,
          genre: editTitle.genre || null,
          release_date: editTitle.release_date || null,
          duration_minutes: editTitle.duration_minutes ? parseInt(editTitle.duration_minutes) : null,
          rating: editTitle.rating || null,
          filmmaker_id: editTitle.filmmaker_id,
          previous_gross_amount: editTitle.previous_gross_amount ? parseFloat(editTitle.previous_gross_amount) : 0,
          previous_expenses: editTitle.previous_expenses ? parseFloat(editTitle.previous_expenses) : 0,
          previous_distribution_fee: editTitle.previous_distribution_fee ? parseFloat(editTitle.previous_distribution_fee) : 0,
          previous_net_revenue: editTitle.previous_net_revenue ? parseFloat(editTitle.previous_net_revenue) : 0,
          previous_amount_paid: editTitle.previous_amount_paid ? parseFloat(editTitle.previous_amount_paid) : 0,
          previous_balance_due: editTitle.previous_balance_due ? parseFloat(editTitle.previous_balance_due) : 0,
        })
        .eq('id', editingTitle.id);

      if (error) throw error;

      // Replace all distribution settings with the current editor state
      await supabase
        .from('title_distribution_settings')
        .delete()
        .eq('title_id', editingTitle.id);

      if (editTitleSplits.length > 0) {
        await supabase
          .from('title_distribution_settings')
          .insert(editTitleSplits.map(row => ({
            title_id: editingTitle.id,
            platform: row.platform ?? null,
            company_percentage: row.company,
            filmmaker_percentage: row.filmmaker,
          })));
      }

      toast.success('Title updated successfully!');
      setShowEditTitle(false);
      setEditingTitle(null);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error updating title. Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleDeleteTitle = (titleId: string) => {
    setConfirmModal({
      title: 'Delete Title',
      message: 'Are you sure you want to delete this title? This action cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const { error } = await supabase.from('content').delete().eq('id', titleId);
          if (error) throw error;
          toast.success('Title deleted successfully!');
          fetchDashboardData();
        } catch (error: any) {
          toast.error(error.message || 'Error deleting title. Please try again.');
        }
      },
    });
  };

  const handleAssignFilmmakerClick = (title: Content) => {
    setAssigningTitle(title);
    setSelectedFilmmakerForAssign(title.filmmaker_id || '');
    setShowAssignFilmmaker(true);
  };

  const handleAssignFilmmaker = async () => {
    if (!assigningTitle || !selectedFilmmakerForAssign) {
      toast.error('Please select a filmmaker');
      return;
    }

    setSavingTitle(true);
    try {
      const { error } = await supabase
        .from('content')
        .update({
          filmmaker_id: selectedFilmmakerForAssign,
          owner_id: selectedFilmmakerForAssign,
        })
        .eq('id', assigningTitle.id);

      if (error) throw error;

      toast.success('Filmmaker assigned successfully!');
      setShowAssignFilmmaker(false);
      setAssigningTitle(null);
      setSelectedFilmmakerForAssign('');
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error assigning filmmaker. Please try again.');
    } finally {
      setSavingTitle(false);
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.title_id || !newPayment.platform || !newPayment.payment_date || !newPayment.gross_amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSavingPayment(true);
    try {
      const { data: titleData, error: titleError } = await supabase
        .from('content')
        .select('*')
        .eq('id', newPayment.title_id)
        .maybeSingle();

      if (titleError) throw titleError;
      if (!titleData) {
        toast.error('Title not found');
        return;
      }

      const grossAmount = parseFloat(newPayment.gross_amount);
      const distributionFee = Math.round(grossAmount * 0.25 * 100) / 100;
      const netAmount = Math.round((grossAmount - distributionFee) * 100) / 100;

      const { error } = await supabase
        .from('payments')
        .insert({
          content_id: newPayment.title_id,
          filmmaker_id: titleData.filmmaker_id,
          payment_date: newPayment.payment_date,
          gross_amount: grossAmount,
          distribution_fee: distributionFee,
          net_amount: netAmount,
          channel: newPayment.platform,
          title_name: titleData.title_name,
          payment_method: 'manual',
          notes: newPayment.notes || null,
          created_by: profile?.id,
        });

      if (error) throw error;

      toast.success('Payment added successfully!');
      setNewPayment({ title_id: '', platform: '', outlet: '', payment_date: '', gross_amount: '', notes: '' });
      setShowAddPayment(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error adding payment. Please try again.');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleApprovePayment = async (requestId: string, approvedAmount: number) => {
    setApprovingId(requestId);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'approved',
          amount_approved: approvedAmount,
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Payment request approved! Filmmaker will be paid within 14 days.');
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error approving payment request. Please try again.');
    } finally {
      setApprovingId(null);
    }
  };

  const handleMarkAsPaid = async (requestId: string, paymentMethod: string) => {
    setMarkingPaidId(requestId);
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'paid',
          payment_method_used: paymentMethod,
          date_paid: new Date().toISOString(),
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Payment marked as paid!');
      setApprovingRequest(null);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message || 'Error marking payment. Please try again.');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Create chart data
  const chartData = streamingPayments
    .filter(payment => payment.content && payment.content.title_name)
    .slice(0, 6)
    .map(payment => ({
      title: payment.content.title_name.substring(0, 15) + (payment.content.title_name.length > 15 ? '...' : ''),
      revenue: payment.gross_amount || 0,
      expenses: (payment.gross_amount || 0) * 0.3, // Estimated expenses
      net: payment.net_amount || 0,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <div className="flex items-center space-x-3">
          {/* Tab Navigation */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'financial'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Financial
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'payments'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Payments
            </button>
            <button
              onClick={() => setActiveTab('titles')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'titles'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Titles
            </button>
            <button
              onClick={() => setActiveTab('filmmakers')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'filmmakers'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Filmmakers
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'requests'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Requests
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'audit'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Audit Log
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'admins'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'titles' && (
              <Button onClick={() => setShowAddTitle(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Title
              </Button>
            )}
            {activeTab === 'filmmakers' && (
              <Button onClick={() => setShowAddFilmmaker(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Filmmaker
              </Button>
            )}
            {activeTab === 'payments' && (
              <>
                <Button onClick={() => setShowPaymentUpload(true)} variant="secondary">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Payments
                </Button>
                <Button onClick={() => setShowAddPayment(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Render content based on active tab */}
      {activeTab === 'financial' && (
        <div key="financial-tab" className="space-y-6">
          <FinancialDashboard userRole="admin" />
          <PaymentHistoryTable
            streamingPayments={streamingPayments}
            titles={titles}
            filmmakers={filmmakers}
            refreshData={fetchDashboardData}
          />
        </div>
      )}
      {activeTab === 'payments' && (
        <div key="payments-tab" className="space-y-6">
          <UnassignedContentManager onUpdate={fetchDashboardData} />
          <PaymentHistoryAdmin onUpdate={fetchDashboardData} />
        </div>
      )}
      {activeTab === 'titles' && (
        <div key="titles-tab" className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Film className="h-5 w-5 mr-2" />
                All Titles Management
              </h3>
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Search titles..."
                  value={titlesSearch}
                  onChange={e => { setTitlesSearch(e.target.value); setTitlesPage(1); }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-48"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowBulkImport(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
                <div className="text-sm text-gray-500">
                  {titles.length} title{titles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {titles.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Filmmaker
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Distribution
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {titles
                      .filter(t => !titlesSearch || t.title_name.toLowerCase().includes(titlesSearch.toLowerCase()) || (t.filmmaker as any)?.email?.toLowerCase().includes(titlesSearch.toLowerCase()))
                      .slice((titlesPage - 1) * PAGE_SIZE, titlesPage * PAGE_SIZE)
                      .map((title) => (
                      <tr key={title.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {title.title_name}
                            </div>
                            {title.genre && (
                              <div className="text-sm text-gray-500">
                                {title.genre}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {title.filmmaker ? (
                            <div>
                              <div>{title.filmmaker.first_name} {title.filmmaker.last_name}</div>
                              <div className="text-xs text-gray-400">{title.filmmaker.email}</div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-red-500">No filmmaker assigned</span>
                              <Button
                                size="sm"
                                onClick={() => handleAssignFilmmakerClick(title)}
                                className="flex items-center space-x-1"
                              >
                                <Users className="h-3 w-3" />
                                <span>Assign</span>
                              </Button>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {title.content_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            title.status === 'approved' ? 'bg-green-100 text-green-800' :
                            title.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {title.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <div>${((title.previous_gross_amount || 0) + (title.revenue_total || 0)).toLocaleString()}</div>
                            <div className="text-xs text-gray-400">
                              Net: ${((title.previous_net_revenue || 0) + (title.net_revenue || 0)).toLocaleString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {title.title_distribution_settings && title.title_distribution_settings.length > 0 ? (
                            <div className="space-y-1">
                              {(() => {
                                const global = title.title_distribution_settings.find(s => !s.platform);
                                const platforms = title.title_distribution_settings.filter(s => !!s.platform);
                                return (
                                  <>
                                    <div className="text-xs font-medium text-gray-700">
                                      Default: {global?.company_percentage ?? 25}% / {global?.filmmaker_percentage ?? 75}%
                                    </div>
                                    {platforms.map(s => (
                                      <div key={s.platform} className="text-xs text-blue-600">
                                        {s.platform}: {s.company_percentage}% / {s.filmmaker_percentage}%
                                      </div>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-yellow-600 text-xs">25% / 75% (default)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEditTitle(title)}
                              className="flex items-center space-x-1"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteTitle(title.id)}
                              className="flex items-center space-x-1"
                            >
                              <X className="h-3 w-3" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Titles Pagination */}
                {(() => {
                  const filtered = titles.filter(t => !titlesSearch || t.title_name.toLowerCase().includes(titlesSearch.toLowerCase()) || (t.filmmaker as any)?.email?.toLowerCase().includes(titlesSearch.toLowerCase()));
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                  if (totalPages <= 1) return null;
                  return (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <span className="text-sm text-gray-600">Showing {(titlesPage - 1) * PAGE_SIZE + 1}–{Math.min(titlesPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={titlesPage === 1} onClick={() => setTitlesPage(p => p - 1)}>Previous</Button>
                        <span className="px-3 py-2 text-sm text-gray-600">Page {titlesPage} of {totalPages}</span>
                        <Button size="sm" variant="secondary" disabled={titlesPage >= totalPages} onClick={() => setTitlesPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No titles yet</h3>
                <p className="text-gray-500 mb-4">
                  Start by adding your first title to the platform
                </p>
                <Button onClick={() => setShowAddTitle(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Title
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <TitleReassignment onUpdate={fetchDashboardData} />
        </div>
      )}
      {activeTab === 'filmmakers' && (
        <div key="filmmakers-tab" className="space-y-6">
          <FilmmakerUserManagement />
          <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="h-5 w-5 mr-2" />
                All Filmmakers
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search filmmakers..."
                  value={filmmakersSearch}
                  onChange={e => { setFilmmakersSearch(e.target.value); setFilmmakersPage(1); }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 w-48"
                />
                <div className="text-sm text-gray-500">
                  {filmmakers.length} filmmaker{filmmakers.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filmmakers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Titles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Earnings
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filmmakers
                      .filter(f => !filmmakersSearch || `${f.first_name} ${f.last_name} ${f.email}`.toLowerCase().includes(filmmakersSearch.toLowerCase()))
                      .slice((filmmakersPage - 1) * PAGE_SIZE, filmmakersPage * PAGE_SIZE)
                      .map((filmmaker) => {
                      const filmmakerTitles = titles.filter(t => t.filmmaker_id === filmmaker.id);
                      return (
                        <tr key={filmmaker.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {filmmaker.first_name} {filmmaker.last_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {filmmaker.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {filmmakerTitles.length}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(filmmaker.total_earnings || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Button
                              size="sm"
                              onClick={() => setViewingFilmmaker(filmmaker)}
                            >
                              View Dashboard
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Filmmakers Pagination */}
                {(() => {
                  const filtered = filmmakers.filter(f => !filmmakersSearch || `${f.first_name} ${f.last_name} ${f.email}`.toLowerCase().includes(filmmakersSearch.toLowerCase()));
                  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                  if (totalPages <= 1) return null;
                  return (
                    <div className="mt-4 flex items-center justify-between border-t pt-4">
                      <span className="text-sm text-gray-600">Showing {(filmmakersPage - 1) * PAGE_SIZE + 1}–{Math.min(filmmakersPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" disabled={filmmakersPage === 1} onClick={() => setFilmmakersPage(p => p - 1)}>Previous</Button>
                        <span className="px-3 py-2 text-sm text-gray-600">Page {filmmakersPage} of {totalPages}</span>
                        <Button size="sm" variant="secondary" disabled={filmmakersPage >= totalPages} onClick={() => setFilmmakersPage(p => p + 1)}>Next</Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No filmmakers yet</h3>
                <p className="text-gray-500 mb-4">
                  Start by adding filmmakers to the platform
                </p>
                <Button onClick={() => setShowAddFilmmaker(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Filmmaker
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      )}
      {activeTab === 'requests' && (
        <Card key="requests-tab">
          <CardHeader>
            <h3 className="text-lg font-semibold flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Payment Requests
            </h3>
          </CardHeader>
          <CardContent>
            {paymentRequests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Filmmaker
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount Requested
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Request Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paymentRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {request.filmmaker?.first_name} {request.filmmaker?.last_name}
                          <div className="text-xs text-gray-500">{request.filmmaker?.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${request.amount_requested.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(request.requested_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status}
                          </span>
                          {request.status === 'approved' && (
                            <div className="text-xs text-gray-500 mt-1">
                              14 days from approval
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {request.payment_method_used || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  loading={approvingId === request.id}
                                  onClick={() => handleApprovePayment(request.id, request.amount_requested)}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() =>
                                    setConfirmModal({
                                      title: 'Reject Payment Request',
                                      message: `Reject this $${request.amount_requested.toLocaleString()} payment request?`,
                                      confirmLabel: 'Reject',
                                      onConfirm: () => {
                                        setConfirmModal(null);
                                        supabase?.from('payment_requests')
                                          .update({ status: 'rejected', approved_by: profile?.id, approved_at: new Date().toISOString() })
                                          .eq('id', request.id)
                                          .then(() => { toast.success('Request rejected.'); fetchDashboardData(); });
                                      },
                                    })
                                  }
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {request.status === 'approved' && (
                              <Button
                                size="sm"
                                onClick={() => setApprovingRequest(request)}
                              >
                                Mark as Paid
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No payment requests</h3>
                <p className="text-gray-500">Payment requests will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {activeTab === 'audit' && (
        <div key="audit-tab">
          <AuditLog />
        </div>
      )}
      {activeTab === 'admins' && (
        <div key="admins-tab">
          <AdminUserManagement />
        </div>
      )}
      {activeTab === 'overview' && (
        <div key="overview-tab">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              icon={Users}
              title="Total Filmmakers"
              value={stats.totalUsers}
              color="bg-blue-600"
            />
            <StatCard
              icon={Film}
              title="Total Titles"
              value={stats.totalTitles}
              color="bg-green-600"
            />
            <StatCard
              icon={DollarSign}
              title="Total Revenue"
              value={`$${stats.totalRevenue.toLocaleString()}`}
              color="bg-emerald-600"
            />
            <StatCard
              icon={DollarSign}
              title="Company Profit (25%)"
              value={`$${stats.companyProfit.toLocaleString()}`}
              color="bg-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <StatCard
              icon={DollarSign}
              title="Paid to Filmmakers"
              value={`$${stats.totalPaidToFilmmakers.toLocaleString()}`}
              color="bg-purple-600"
            />
            <StatCard
              icon={DollarSign}
              title="Net Profit/Loss"
              value={`$${(stats.companyProfit - stats.totalPaidToFilmmakers).toLocaleString()}`}
              color={(stats.companyProfit - stats.totalPaidToFilmmakers) >= 0 ? "bg-green-600" : "bg-red-600"}
            />
            <StatCard
              icon={Clock}
              title="Pending Requests"
              value={stats.pendingRequests}
              color="bg-orange-600"
            />
          </div>

          {/* Revenue Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Revenue Overview
                </h3>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="title" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name === 'revenue' ? 'Revenue' : name === 'expenses' ? 'Expenses' : 'Net']}
                        labelFormatter={(label) => `Title: ${label}`}
                      />
                      <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
                      <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                      <Bar dataKey="net" fill="#3B82F6" name="Net" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>No revenue data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Payment Requests */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Recent Payment Requests</h3>
              </CardHeader>
              <CardContent>
                {paymentRequests.length > 0 ? (
                  <div className="space-y-3">
                    {paymentRequests.slice(0, 5).map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            ${request.amount_requested.toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            {request.filmmaker?.first_name} {request.filmmaker?.last_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(request.requested_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {request.status}
                          </span>
                          {request.status === 'pending' && (
                            <div className="flex space-x-1 mt-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprovePayment(request.id, request.amount_requested)}
                                className="text-xs"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  // Handle reject payment
                                }}
                                className="text-xs"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">No payment requests</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top 10 Leaderboard + Filmmaker Summary */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
            <TopTitlesLeaderboard />
            <FilmmakerSummaryReport />
          </div>

          {/* All Titles Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  <Film className="h-5 w-5 mr-2" />
                  All Titles Management
                </h3>
                <div className="text-sm text-gray-500">
                  {titles.length} title{titles.length !== 1 ? 's' : ''}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {titles.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Filmmaker
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Distribution
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {titles.map((title) => (
                        <tr key={title.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {title.title_name}
                              </div>
                              {title.genre && (
                                <div className="text-sm text-gray-500">
                                  {title.genre}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {title.filmmaker ? (
                              <div>
                                <div>{title.filmmaker.first_name} {title.filmmaker.last_name}</div>
                                <div className="text-xs text-gray-400">{title.filmmaker.email}</div>
                              </div>
                            ) : (
                              <span className="text-red-500">No filmmaker assigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {title.content_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              title.status === 'approved' ? 'bg-green-100 text-green-800' :
                              title.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {title.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              <div>${((title.previous_gross_amount || 0) + (title.revenue_total || 0)).toLocaleString()}</div>
                              <div className="text-xs text-gray-400">
                                Net: ${((title.previous_net_revenue || 0) + (title.net_revenue || 0)).toLocaleString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {title.title_distribution_settings && title.title_distribution_settings.length > 0 ? (
                              <div className="space-y-1">
                                {(() => {
                                  const global = title.title_distribution_settings.find(s => !s.platform);
                                  const platforms = title.title_distribution_settings.filter(s => !!s.platform);
                                  return (
                                    <>
                                      <div className="text-xs font-medium text-gray-700">
                                        Default: {global?.company_percentage ?? 25}% / {global?.filmmaker_percentage ?? 75}%
                                      </div>
                                      {platforms.map(s => (
                                        <div key={s.platform} className="text-xs text-blue-600">
                                          {s.platform}: {s.company_percentage}% / {s.filmmaker_percentage}%
                                        </div>
                                      ))}
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="text-yellow-600 text-xs">25% / 75% (default)</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleEditTitle(title)}
                                className="flex items-center space-x-1"
                              >
                                <Edit className="h-3 w-3" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteTitle(title.id)}
                                className="flex items-center space-x-1"
                              >
                                <X className="h-3 w-3" />
                                <span>Delete</span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Film className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No titles yet</h3>
                  <p className="text-gray-500 mb-4">
                    Start by adding your first title to the platform
                  </p>
                  <Button onClick={() => setShowAddTitle(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Title
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Title Modal */}
      {showAddTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Title</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Title Name"
                    value={newTitle.title_name}
                    onChange={(e) => setNewTitle({ ...newTitle, title_name: e.target.value })}
                    placeholder="Enter title name"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Type
                    </label>
                    <select
                      value={newTitle.content_type}
                      onChange={(e) => setNewTitle({ ...newTitle, content_type: e.target.value as 'movie' | 'series' | 'episode' })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                      <option value="episode">Episode</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filmmaker
                  </label>
                  <select
                    value={newTitle.filmmaker_id}
                    onChange={(e) => setNewTitle({ ...newTitle, filmmaker_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a filmmaker</option>
                    {filmmakers.map((filmmaker) => (
                      <option key={filmmaker.id} value={filmmaker.id}>
                        {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Genre"
                    value={newTitle.genre}
                    onChange={(e) => setNewTitle({ ...newTitle, genre: e.target.value })}
                    placeholder="e.g., Drama, Comedy"
                  />
                  <Input
                    label="Release Date"
                    type="date"
                    value={newTitle.release_date}
                    onChange={(e) => setNewTitle({ ...newTitle, release_date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Duration (minutes)"
                    type="number"
                    value={newTitle.duration_minutes}
                    onChange={(e) => setNewTitle({ ...newTitle, duration_minutes: e.target.value })}
                    placeholder="120"
                  />
                  <Input
                    label="Rating"
                    value={newTitle.rating}
                    onChange={(e) => setNewTitle({ ...newTitle, rating: e.target.value })}
                    placeholder="PG-13, R, etc."
                  />
                  <Input
                    label="Company Distribution %"
                    type="number"
                    value={newTitle.distribution_percentage}
                    onChange={(e) => setNewTitle({ ...newTitle, distribution_percentage: e.target.value })}
                    placeholder="25"
                  />
                </div>

                <Input
                  label="Description"
                  value={newTitle.description}
                  onChange={(e) => setNewTitle({ ...newTitle, description: e.target.value })}
                  placeholder="Brief description of the title"
                />

                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Historical Financial Data (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Previous Gross Amount"
                      type="number"
                      value={newTitle.previous_gross_amount}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_gross_amount: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Expenses"
                      type="number"
                      value={newTitle.previous_expenses}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_expenses: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Distribution Fee"
                      type="number"
                      value={newTitle.previous_distribution_fee}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_distribution_fee: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Net Revenue"
                      type="number"
                      value={newTitle.previous_net_revenue}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_net_revenue: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Amount Paid"
                      type="number"
                      value={newTitle.previous_amount_paid}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_amount_paid: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Balance Due"
                      type="number"
                      value={newTitle.previous_balance_due}
                      onChange={(e) => setNewTitle({ ...newTitle, previous_balance_due: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddTitle(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTitle}>
                  Create Title
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Modal */}
      {showEditTitle && editingTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Title: {editingTitle.title_name}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Title Name"
                    value={editTitle.title_name}
                    onChange={(e) => setEditTitle({ ...editTitle, title_name: e.target.value })}
                    placeholder="Enter title name"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Content Type
                    </label>
                    <select
                      value={editTitle.content_type}
                      onChange={(e) => setEditTitle({ ...editTitle, content_type: e.target.value as 'movie' | 'series' | 'episode' })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                      <option value="episode">Episode</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filmmaker
                  </label>
                  <select
                    value={editTitle.filmmaker_id}
                    onChange={(e) => setEditTitle({ ...editTitle, filmmaker_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a filmmaker</option>
                    {filmmakers.map((filmmaker) => (
                      <option key={filmmaker.id} value={filmmaker.id}>
                        {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Genre"
                    value={editTitle.genre}
                    onChange={(e) => setEditTitle({ ...editTitle, genre: e.target.value })}
                    placeholder="e.g., Drama, Comedy"
                  />
                  <Input
                    label="Release Date"
                    type="date"
                    value={editTitle.release_date}
                    onChange={(e) => setEditTitle({ ...editTitle, release_date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Duration (minutes)"
                    type="number"
                    value={editTitle.duration_minutes}
                    onChange={(e) => setEditTitle({ ...editTitle, duration_minutes: e.target.value })}
                    placeholder="120"
                  />
                  <Input
                    label="Rating"
                    value={editTitle.rating}
                    onChange={(e) => setEditTitle({ ...editTitle, rating: e.target.value })}
                    placeholder="PG-13, R, etc."
                  />
                </div>

                <Input
                  label="Description"
                  value={editTitle.description}
                  onChange={(e) => setEditTitle({ ...editTitle, description: e.target.value })}
                  placeholder="Brief description of the title"
                />

                {/* Distribution splits */}
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Distribution Splits</h4>
                  <PlatformSplitEditor
                    value={editTitleSplits}
                    onChange={setEditTitleSplits}
                  />
                </div>

                <div className="border-t pt-4">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Historical Financial Data</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Previous Gross Amount"
                      type="number"
                      value={editTitle.previous_gross_amount}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_gross_amount: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Expenses"
                      type="number"
                      value={editTitle.previous_expenses}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_expenses: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Distribution Fee"
                      type="number"
                      value={editTitle.previous_distribution_fee}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_distribution_fee: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Net Revenue"
                      type="number"
                      value={editTitle.previous_net_revenue}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_net_revenue: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Amount Paid"
                      type="number"
                      value={editTitle.previous_amount_paid}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_amount_paid: e.target.value })}
                      placeholder="0.00"
                    />
                    <Input
                      label="Previous Balance Due"
                      type="number"
                      value={editTitle.previous_balance_due}
                      onChange={(e) => setEditTitle({ ...editTitle, previous_balance_due: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEditTitle(false);
                    setEditingTitle(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateTitle}>
                  Update Title
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Filmmaker Modal */}
      {showAddFilmmaker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Filmmaker</h3>
              <div className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  value={newFilmmaker.email}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, email: e.target.value })}
                  placeholder="filmmaker@example.com"
                />
                <Input
                  label="First Name"
                  value={newFilmmaker.first_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, first_name: e.target.value })}
                  placeholder="John"
                />
                <Input
                  label="Last Name"
                  value={newFilmmaker.last_name}
                  onChange={(e) => setNewFilmmaker({ ...newFilmmaker, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddFilmmaker(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateFilmmaker}>
                  Create Filmmaker
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Payment</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={newPayment.title_id}
                    onChange={(e) => setNewPayment({ ...newPayment, title_id: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a title</option>
                    {titles.map((title) => (
                      <option key={title.id} value={title.id}>
                        {title.title_name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Platform"
                  value={newPayment.platform}
                  onChange={(e) => setNewPayment({ ...newPayment, platform: e.target.value })}
                  placeholder="Netflix, Amazon Prime, etc."
                />
                <Input
                  label="Outlet (Optional)"
                  value={newPayment.outlet}
                  onChange={(e) => setNewPayment({ ...newPayment, outlet: e.target.value })}
                  placeholder="Specific outlet or region"
                />
                <Input
                  label="Payment Date"
                  type="date"
                  value={newPayment.payment_date}
                  onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                />
                <Input
                  label="Gross Amount"
                  type="number"
                  value={newPayment.gross_amount}
                  onChange={(e) => setNewPayment({ ...newPayment, gross_amount: e.target.value })}
                  placeholder="1000.00"
                />
                <Input
                  label="Notes (Optional)"
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  placeholder="Additional notes about this payment"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={() => setShowAddPayment(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddPayment}>
                  Add Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Upload Modal */}
      {showPaymentUpload && profile && (
        <PaymentUpload
          onUploadComplete={fetchDashboardData}
          onClose={() => setShowPaymentUpload(false)}
          titles={titles}
          adminId={profile.id}
        />
      )}

      {/* View Filmmaker Dashboard Modal */}
      {viewingFilmmaker && (
        <FilmmakerViewAdmin
          filmmaker={viewingFilmmaker}
          onClose={() => setViewingFilmmaker(null)}
        />
      )}

      {/* Mark Payment as Paid Modal */}
      {approvingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Mark Payment as Paid</h3>
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="font-medium">Filmmaker:</span>{' '}
                    {approvingRequest.filmmaker?.first_name} {approvingRequest.filmmaker?.last_name}
                  </div>
                  <div>
                    <span className="font-medium">Amount:</span>{' '}
                    ${approvingRequest.amount_requested.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Select the payment method used:
                </p>
                <Button
                  onClick={() => handleMarkAsPaid(approvingRequest.id, 'PayPal')}
                  className="w-full"
                >
                  PayPal
                </Button>
                <Button
                  onClick={() => handleMarkAsPaid(approvingRequest.id, 'Venmo')}
                  className="w-full"
                >
                  Venmo
                </Button>
                <Button
                  onClick={() => handleMarkAsPaid(approvingRequest.id, 'Other')}
                  className="w-full"
                >
                  Other
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setApprovingRequest(null)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Title Import Modal */}
      {showBulkImport && (
        <BulkTitleImport
          onClose={() => setShowBulkImport(false)}
          onComplete={fetchDashboardData}
        />
      )}

      {/* Assign Filmmaker Modal */}
      {showAssignFilmmaker && assigningTitle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                Assign Filmmaker to "{assigningTitle.title_name}"
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Title:</span> {assigningTitle.title_name}
                </p>
                {assigningTitle.filmmaker && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Current Filmmaker:</span>{' '}
                    {assigningTitle.filmmaker.first_name} {assigningTitle.filmmaker.last_name} ({assigningTitle.filmmaker.email})
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Filmmaker
                  </label>
                  <select
                    value={selectedFilmmakerForAssign}
                    onChange={(e) => setSelectedFilmmakerForAssign(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Choose a filmmaker...</option>
                    {filmmakers.map((filmmaker) => (
                      <option key={filmmaker.id} value={filmmaker.id}>
                        {filmmaker.first_name} {filmmaker.last_name} ({filmmaker.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowAssignFilmmaker(false);
                      setAssigningTitle(null);
                      setSelectedFilmmakerForAssign('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignFilmmaker}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Assign Filmmaker
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}