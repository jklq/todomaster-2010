import { useState } from 'react';
import { User, Lock, Trash2, X, Check, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { auth } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  
  // Profile editing state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');
    setIsSavingProfile(true);
    
    try {
      const updatedUser = await auth.updateProfile(displayName);
      queryClient.setQueryData(['me'], updatedUser);
      setProfileSuccess('Profile updated successfully!');
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setIsChangingPassword(true);
    
    try {
      await auth.changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password changed successfully! You will need to log in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    
    setIsDeleting(true);
    try {
      await auth.deleteAccount();
      logout();
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fadeIn backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.5)] w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-gray-400">
        {/* Header */}
        <div className="bg-gradient-to-b from-gray-100 to-gray-300 px-6 py-4 border-b border-gray-400 flex items-center justify-between rounded-t-lg shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded border border-transparent hover:border-gray-400 hover:bg-gradient-to-b hover:from-white hover:to-gray-200 hover:shadow-sm text-gray-600 active:shadow-inner active:bg-gray-200 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 inset-text drop-shadow-sm font-sans">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded border border-transparent hover:border-gray-400 hover:bg-gradient-to-b hover:from-white hover:to-gray-200 hover:shadow-sm text-gray-500 active:shadow-inner active:bg-gray-200 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-8 bg-gray-50">
          {/* Profile Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 pb-2 border-b border-gray-300 shadow-[0_1px_0_#ffffff]">
              <User size={18} className="text-gray-500 drop-shadow-sm" />
              <h3 className="font-bold uppercase text-sm tracking-wide text-gray-600 inset-text">Profile</h3>
            </div>
            
            <div className="bg-white rounded border border-gray-300 p-4 space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 inset-text">
                  Email
                </label>
                <div className="text-gray-800 bg-gray-100 px-3 py-2 rounded border border-gray-300 shadow-inner italic text-gray-600">
                  {user?.email}
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 inset-text">
                  Display Name
                </label>
                {isEditingProfile ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-inner bg-white"
                      placeholder="Enter display name..."
                    />
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="p-2 text-green-700 bg-gradient-to-b from-green-100 to-green-200 border border-green-300 hover:from-green-200 hover:to-green-300 rounded shadow-sm active:shadow-inner disabled:opacity-50"
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingProfile(false);
                        setDisplayName(user?.displayName || '');
                      }}
                      className="p-2 text-gray-600 bg-gradient-to-b from-gray-100 to-gray-200 border border-gray-300 hover:from-gray-200 hover:to-gray-300 rounded shadow-sm active:shadow-inner"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="text-gray-800 bg-gray-50 px-3 py-2 rounded border border-gray-300 shadow-inner flex-1">
                      {user?.displayName || <span className="text-gray-400 italic">Not set</span>}
                    </div>
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="ml-2 px-3 py-2 text-sm text-gray-700 font-bold bg-gradient-to-b from-white to-gray-100 border border-gray-300 rounded shadow-sm hover:from-gray-50 hover:to-gray-200 active:shadow-inner active:from-gray-200 active:to-gray-300"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              
              {profileError && (
                <div className="text-red-700 text-sm bg-red-100 px-3 py-2 rounded border border-red-300 shadow-inner">
                  {profileError}
                </div>
              )}
              {profileSuccess && (
                <div className="text-green-700 text-sm bg-green-100 px-3 py-2 rounded border border-green-300 shadow-inner">
                  {profileSuccess}
                </div>
              )}
            </div>
          </section>

          {/* Password Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700 pb-2 border-b border-gray-300 shadow-[0_1px_0_#ffffff]">
              <Lock size={18} className="text-gray-500 drop-shadow-sm" />
              <h3 className="font-bold uppercase text-sm tracking-wide text-gray-600 inset-text">Change Password</h3>
            </div>
            
            <div className="bg-white rounded border border-gray-300 p-4 space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 inset-text">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 inset-text">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 inset-text">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              
              {passwordError && (
                <div className="text-red-700 text-sm bg-red-100 px-3 py-2 rounded border border-red-300 shadow-inner">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="text-green-700 text-sm bg-green-100 px-3 py-2 rounded border border-green-300 shadow-inner">
                  {passwordSuccess}
                </div>
              )}
              
              <button
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword || !confirmPassword || isChangingPassword}
                className="w-full btn-primary-gradient text-white font-bold py-2 px-4 rounded border border-blue-800 shadow-md active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed inset-text-dark"
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-red-700 pb-2 border-b border-gray-300 shadow-[0_1px_0_#ffffff]">
              <AlertTriangle size={18} className="drop-shadow-sm" />
              <h3 className="font-bold uppercase text-sm tracking-wide inset-text">Danger Zone</h3>
            </div>
            
            <div className="bg-red-50 rounded border border-red-200 p-4 space-y-4 shadow-inner">
              <p className="text-sm text-red-800">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              
              {showDeleteConfirm ? (
                <div className="space-y-3">
                  <p className="text-sm text-red-700 font-bold inset-text-dark">
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 shadow-inner bg-white"
                    placeholder="DELETE"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                      className="flex-1 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold py-2 px-4 rounded border border-red-900 shadow-md active:shadow-inner disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 inset-text-dark"
                    >
                      <Trash2 size={16} />
                      {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText('');
                      }}
                      className="px-4 py-2 bg-gradient-to-b from-gray-100 to-gray-300 hover:from-gray-200 hover:to-gray-400 text-gray-700 font-bold rounded border border-gray-400 shadow-sm active:shadow-inner"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-gradient-to-b from-white to-red-50 hover:from-white hover:to-red-100 text-red-700 font-bold py-2 px-4 rounded border border-red-300 shadow-sm hover:shadow active:shadow-inner flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete Account
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
