import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Textarea } from './components/ui/textarea';
import { Badge } from './components/ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    // Check for session_id in URL fragment
    const handleSessionId = async () => {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        setLoading(true);
        const sessionId = hash.split('session_id=')[1].split('&')[0];
        
        try {
          const response = await axios.post(`${API}/auth/session`, {}, {
            headers: {
              'X-Session-ID': sessionId
            }
          });
          
          setUser(response.data.user);
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate('/dashboard');
        } catch (error) {
          console.error('Authentication failed:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    
    handleSessionId();
  }, [navigate]);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const value = {
    user,
    loading,
    logout,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
  </div>
);

const LoginPage = () => {
  const { user } = useAuth();
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGoogleLogin = () => {
    const redirectUrl = encodeURIComponent(`${window.location.origin}/dashboard`);
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Delivery Dashboard</CardTitle>
          <p className="text-gray-600 mt-2">লজিস্টিক্স ড্যাশবোর্ডে স্বাগতম</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleGoogleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
          >
            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google দিয়ে লগইন করুন
          </Button>
          <div className="text-sm text-gray-500 text-center">
            <p>ব্যবহার করে আপনি আমাদের শর্তাবলী মেনে নিচ্ছেন</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Navigation = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-gray-900">Delivery Dashboard</h1>
            <div className="flex space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium">Dashboard</Link>
              <Link to="/entries" className="text-gray-700 hover:text-blue-600 font-medium">My Entries</Link>
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-gray-700 hover:text-blue-600 font-medium">Admin</Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img src={user?.picture || '/api/placeholder/32/32'} alt="User" className="w-8 h-8 rounded-full" />
              <span className="text-gray-700 font-medium">{user?.name}</span>
              {user?.role === 'admin' && (
                <Badge variant="destructive">Admin</Badge>
              )}
            </div>
            <Button variant="outline" onClick={logout}>Logout</Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

const KPICard = ({ title, value, subtitle, trend, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700"
  };

  return (
    <Card className={`border-2 ${colorClasses[color]}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {trend && (
            <div className="text-right">
              <p className="text-sm font-medium text-gray-600">{trend}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, chartRes] = await Promise.all([
        axios.get(`${API}/dashboard/summary`),
        axios.get(`${API}/dashboard/chart-data`)
      ]);
      
      setSummary(summaryRes.data);
      setChartData(chartRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const formatCurrency = (amount) => `৳${amount.toLocaleString()}`;
  const formatPercentage = (rate) => `${rate.toFixed(1)}%`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">সকল ডেটার সামগ্রিক পরিসংখ্যান</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Challan Amount"
            value={formatCurrency(summary?.total_challan_amount || 0)}
            subtitle="মোট চালান পরিমাণ"
            color="blue"
          />
          <KPICard
            title="Total Delivered"
            value={formatCurrency(summary?.total_delivered_amount || 0)}
            subtitle="মোট ডেলিভারি পরিমাণ"
            color="green"
          />
          <KPICard
            title="Total Pending"
            value={formatCurrency(summary?.total_pending_amount || 0)}
            subtitle="মোট বকেয়া পরিমাণ"
            color="yellow"
          />
          <KPICard
            title="Recent Entries"
            value={summary?.recent_entries_count || 0}
            subtitle="গত ৭ দিনের এন্ট্রি"
            color="purple"
          />
        </div>

        {/* Vehicle Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KPICard
            title="Vehicle Required"
            value={summary?.total_vehicle_required || 0}
            subtitle="প্রয়োজনীয় যানবাহন"
            color="blue"
          />
          <KPICard
            title="Vehicle Confirmed"
            value={summary?.total_vehicle_confirmed || 0}
            subtitle="নিশ্চিত যানবাহন"
            color="green"
          />
          <KPICard
            title="Vehicle Missing"
            value={summary?.total_vehicle_missing || 0}
            subtitle="অনুপস্থিত যানবাহন"
            color="red"
          />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <KPICard
            title="Delivery Rate"
            value={formatPercentage(summary?.delivery_rate || 0)}
            subtitle="ডেলিভারি হার (ডেলিভারি/চালান)"
            color="green"
          />
          <KPICard
            title="Vehicle Utilization"
            value={formatPercentage(summary?.vehicle_utilization_rate || 0)}
            subtitle="যানবাহন ব্যবহারের হার"
            color="purple"
          />
        </div>

        {/* Charts */}
        {chartData?.daily_trend?.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Trend - Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.daily_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Area type="monotone" dataKey="challan_amount" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="delivered_amount" stackId="2" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="pending_amount" stackId="3" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Trend - Vehicles</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.daily_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="_id" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="vehicle_required" fill="#3B82F6" />
                    <Bar dataKey="vehicle_confirmed" fill="#10B981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

const EntryForm = ({ entry, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    date: entry?.date || new Date().toISOString().split('T')[0],
    challan_amount: entry?.challan_amount || '',
    delivered_amount: entry?.delivered_amount || '',
    pending_amount: entry?.pending_amount || '',
    vehicle_required: entry?.vehicle_required || '',
    vehicle_confirmed: entry?.vehicle_confirmed || '',
    vehicle_missing: entry?.vehicle_missing || '',
    notes: entry?.notes || ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const data = {
        ...formData,
        challan_amount: parseFloat(formData.challan_amount),
        delivered_amount: parseFloat(formData.delivered_amount),
        pending_amount: parseFloat(formData.pending_amount),
        vehicle_required: parseInt(formData.vehicle_required),
        vehicle_confirmed: parseInt(formData.vehicle_confirmed),
        vehicle_missing: parseInt(formData.vehicle_missing)
      };
      
      if (entry) {
        await axios.put(`${API}/entries/${entry.id}`, data);
      } else {
        await axios.post(`${API}/entries`, data);
      }
      
      onSave();
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entry ? 'Edit Entry' : 'Add New Entry'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challan Amount</label>
              <Input
                type="number"
                step="0.01"
                value={formData.challan_amount}
                onChange={(e) => setFormData({...formData, challan_amount: e.target.value})}
                placeholder="চালান পরিমাণ"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivered Amount</label>
              <Input
                type="number"
                step="0.01"
                value={formData.delivered_amount}
                onChange={(e) => setFormData({...formData, delivered_amount: e.target.value})}
                placeholder="ডেলিভারি পরিমাণ"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pending Amount</label>
              <Input
                type="number"
                step="0.01"
                value={formData.pending_amount}
                onChange={(e) => setFormData({...formData, pending_amount: e.target.value})}
                placeholder="বকেয়া পরিমাণ"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Required</label>
              <Input
                type="number"
                value={formData.vehicle_required}
                onChange={(e) => setFormData({...formData, vehicle_required: e.target.value})}
                placeholder="প্রয়োজনীয় যানবাহন"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Confirmed</label>
              <Input
                type="number"
                value={formData.vehicle_confirmed}
                onChange={(e) => setFormData({...formData, vehicle_confirmed: e.target.value})}
                placeholder="নিশ্চিত যানবাহন"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Missing</label>
              <Input
                type="number"
                value={formData.vehicle_missing}
                onChange={(e) => setFormData({...formData, vehicle_missing: e.target.value})}
                placeholder="অনুপস্থিত যানবাহন"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="অতিরিক্ত নোট..."
              rows={3}
            />
          </div>
          
          <div className="flex space-x-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Entry'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const MyEntries = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const response = await axios.get(`${API}/entries`);
      setEntries(response.data);
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    setShowForm(false);
    setEditingEntry(null);
    fetchEntries();
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await axios.delete(`${API}/entries/${entryId}`);
      fetchEntries();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  if (loading) return <LoadingSpinner />;

  const formatCurrency = (amount) => `৳${amount.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">My Entries</h2>
            <p className="text-gray-600">আপনার ডেলিভারি এন্ট্রিসমূহ</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            Add New Entry
          </Button>
        </div>

        {showForm && (
          <div className="mb-8">
            <EntryForm 
              entry={editingEntry}
              onSave={handleSave}
              onCancel={() => {
                setShowForm(false);
                setEditingEntry(null);
              }}
            />
          </div>
        )}

        {entries.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500 text-lg">No entries found. Add your first entry!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Date</p>
                      <p className="text-lg font-semibold">{entry.date}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Challan Amount</p>
                      <p className="text-lg font-semibold text-blue-600">{formatCurrency(entry.challan_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Delivered</p>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(entry.delivered_amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-lg font-semibold text-yellow-600">{formatCurrency(entry.pending_amount)}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Vehicle Required</p>
                      <p className="text-lg font-semibold">{entry.vehicle_required}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Vehicle Confirmed</p>
                      <p className="text-lg font-semibold text-green-600">{entry.vehicle_confirmed}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Vehicle Missing</p>
                      <p className="text-lg font-semibold text-red-600">{entry.vehicle_missing}</p>
                    </div>
                  </div>
                  
                  {entry.notes && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-600">Notes</p>
                      <p className="text-gray-700">{entry.notes}</p>
                    </div>
                  )}
                  
                  <div className="flex space-x-2 mt-6">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEdit(entry)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('entries');

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminData();
    }
  }, [user]);

  const fetchAdminData = async () => {
    try {
      const [entriesRes, usersRes] = await Promise.all([
        axios.get(`${API}/admin/entries`),
        axios.get(`${API}/admin/users`)
      ]);
      
      setEntries(entriesRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API}/admin/export`);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `delivery-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) return <LoadingSpinner />;

  const formatCurrency = (amount) => `৳${amount.toLocaleString()}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h2>
            <p className="text-gray-600">Manage all data and users</p>
          </div>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
            Export Data
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('entries')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'entries'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Entries ({entries.length})
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users ({users.length})
            </button>
          </nav>
        </div>

        {/* Entries Tab */}
        {activeTab === 'entries' && (
          <div className="grid gap-6">
            {entries.map((entry) => {
              const user = users.find(u => u.id === entry.user_id);
              return (
                <Card key={entry.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Entry by: {user?.name || 'Unknown User'}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <p className="text-sm text-gray-500">{new Date(entry.created_at).toLocaleDateString()}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Date</p>
                        <p className="text-lg font-semibold">{entry.date}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Challan Amount</p>
                        <p className="text-lg font-semibold text-blue-600">{formatCurrency(entry.challan_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Delivered</p>
                        <p className="text-lg font-semibold text-green-600">{formatCurrency(entry.delivered_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pending</p>
                        <p className="text-lg font-semibold text-yellow-600">{formatCurrency(entry.pending_amount)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Vehicle Required</p>
                        <p className="text-lg font-semibold">{entry.vehicle_required}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Vehicle Confirmed</p>
                        <p className="text-lg font-semibold text-green-600">{entry.vehicle_confirmed}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Vehicle Missing</p>
                        <p className="text-lg font-semibold text-red-600">{entry.vehicle_missing}</p>
                      </div>
                    </div>
                    
                    {entry.notes && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-600">Notes</p>
                        <p className="text-gray-700">{entry.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="grid gap-4">
            {users.map((user) => {
              const userEntries = entries.filter(entry => entry.user_id === user.id);
              return (
                <Card key={user.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <img src={user.picture || '/api/placeholder/48/48'} alt={user.name} className="w-12 h-12 rounded-full" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">{user.name}</h3>
                          {user.role === 'admin' && (
                            <Badge variant="destructive">Admin</Badge>
                          )}
                        </div>
                        <p className="text-gray-600">{user.email}</p>
                        <p className="text-sm text-gray-500">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{userEntries.length}</p>
                        <p className="text-sm text-gray-600">Entries</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <div className="App">
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/entries" element={
              <ProtectedRoute>
                <MyEntries />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminPanel />
              </ProtectedRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </div>
  );
}

export default App;