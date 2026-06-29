import React, { useState, useEffect, useRef } from 'react';
import { Bell, DollarSign, CheckCircle, XCircle, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface Notification {
  id: string;
  type: 'payment_added' | 'request_approved' | 'request_rejected' | 'request_paid';
  message: string;
  subtext?: string;
  timestamp: Date;
  read: boolean;
}

const TYPE_META = {
  payment_added:    { icon: DollarSign,   color: 'text-green-600',  bg: 'bg-green-50'  },
  request_approved: { icon: CheckCircle,  color: 'text-blue-600',   bg: 'bg-blue-50'   },
  request_rejected: { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50'    },
  request_paid:     { icon: DollarSign,   color: 'text-purple-600', bg: 'bg-purple-50' },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  const addNotification = (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    setNotifications(prev => [
      { ...n, id: crypto.randomUUID(), timestamp: new Date(), read: false },
      ...prev.slice(0, 49), // keep at most 50
    ]);
  };

  useEffect(() => {
    if (!supabase || !profile) return;

    // Subscribe to new payments
    const paymentSub = supabase
      .channel('notifications_payments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, payload => {
        const row = payload.new as any;
        addNotification({
          type: 'payment_added',
          message: 'New payment added',
          subtext: `${row.channel ?? 'Unknown platform'} · $${(row.gross_amount ?? 0).toLocaleString()}`,
        });
      })
      .subscribe();

    // Subscribe to payment request status changes
    const requestSub = supabase
      .channel('notifications_requests')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_requests' }, payload => {
        const row = payload.new as any;
        const old = payload.old as any;
        if (row.status === old.status) return; // ignore non-status updates

        if (row.status === 'approved') {
          addNotification({
            type: 'request_approved',
            message: 'Payment request approved',
            subtext: `$${(row.amount_approved ?? row.amount_requested ?? 0).toLocaleString()} approved`,
          });
        } else if (row.status === 'rejected') {
          addNotification({
            type: 'request_rejected',
            message: 'Payment request rejected',
            subtext: `$${(row.amount_requested ?? 0).toLocaleString()} request declined`,
          });
        } else if (row.status === 'paid') {
          addNotification({
            type: 'request_paid',
            message: 'Payment marked as paid',
            subtext: `$${(row.amount_approved ?? row.amount_requested ?? 0).toLocaleString()} via ${row.payment_method_used ?? 'transfer'}`,
          });
        }
      })
      .subscribe();

    return () => {
      paymentSub.unsubscribe();
      requestSub.unsubscribe();
    };
  }, [profile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const dismiss = (id: string) =>
    setNotifications(prev => prev.filter(n => n.id !== id));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open) markAllRead();
        }}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">Events will appear here in real time</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type];
                const Icon = meta.icon;
                return (
                  <div key={n.id} className={`flex items-start gap-3 px-4 py-3 ${meta.bg} group`}>
                    <div className={`flex-shrink-0 mt-0.5 p-1.5 rounded-full bg-white shadow-sm ${meta.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{n.message}</p>
                      {n.subtext && (
                        <p className="text-xs text-gray-500 mt-0.5">{n.subtext}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
