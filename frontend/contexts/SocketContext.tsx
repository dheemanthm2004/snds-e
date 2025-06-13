'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { SocketNotification } from '../types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: SocketNotification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<SocketNotification[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize socket connection
      const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      setSocket(socketInstance);

      // Connection event handlers
      socketInstance.on('connect', () => {
        console.log('Socket connected:', socketInstance.id);
        setIsConnected(true);
        
        // Join user's personal room
        socketInstance.emit('join', user.id);
        
        toast.success('Connected to real-time notifications');
      });

      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
        toast.error('Disconnected from real-time notifications');
      });

      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Notification event handlers
      socketInstance.on('notification', (notification: SocketNotification) => {
        console.log('Received notification:', notification);
        
        setNotifications(prev => [notification, ...prev.slice(0, 49)]); // Keep last 50
        
        // Show toast notification
        const toastMessage = notification.title 
          ? `${notification.title}: ${notification.message}`
          : notification.message;
          
        switch (notification.type) {
          case 'success':
            toast.success(toastMessage);
            break;
          case 'warning':
            toast(toastMessage, { icon: '⚠️' });
            break;
          case 'error':
            toast.error(toastMessage);
            break;
          default:
            toast(toastMessage, { icon: '📢' });
        }
      });

      socketInstance.on('pending_notifications', (pendingNotifications: SocketNotification[]) => {
        console.log('Received pending notifications:', pendingNotifications);
        setNotifications(prev => {
          const combined = [...pendingNotifications, ...prev];
          // Remove duplicates and keep only last 50
          const unique = combined.filter((notif, index, arr) => 
            arr.findIndex(n => n.id === notif.id) === index
          );
          return unique.slice(0, 50);
        });
      });

      socketInstance.on('notification_read', ({ notificationId }: { notificationId: string }) => {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read: true }
              : notif
          )
        );
      });

      socketInstance.on('all_notifications_read', () => {
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true }))
        );
      });

      socketInstance.on('notification_deleted', ({ notificationId }: { notificationId: string }) => {
        setNotifications(prev => 
          prev.filter(notif => notif.id !== notificationId)
        );
      });

      // Cleanup on unmount
      return () => {
        socketInstance.disconnect();
        setSocket(null);
        setIsConnected(false);
        setNotifications([]);
      };
    } else {
      // User not authenticated, cleanup socket
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setNotifications([]);
      }
    }
  }, [isAuthenticated, user]);

  const markAsRead = (notificationId: string) => {
    if (socket && user) {
      socket.emit('mark_read', { notificationId, userId: user.id });
    }
  };

  const markAllAsRead = () => {
    if (socket && user) {
      socket.emit('mark_all_read', user.id);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(notif => !notif.read).length;

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export default SocketContext;