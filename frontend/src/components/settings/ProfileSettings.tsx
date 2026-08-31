'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Lock, Mail, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { UserAvatar } from '@/components/brand/UserAvatar';
import { api } from '@/lib/api';

const GENDER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' }
];

const inputClass =
  'w-full text-sm bg-surface-container-low px-4 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground';

export function ProfileSettings() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user?.display_name ?? '');
    setBio(user?.bio ?? '');
    setGender(user?.gender ?? '');
  }, [user?.display_name, user?.bio, user?.gender]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setProfileError('Display name is required to save your profile.');
      setProfileMessage(null);
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await api.updateProfile({
        display_name: name,
        bio: bio.trim() || null,
        gender: gender.trim() || null
      });
      await refreshUser();
      setProfileMessage('Profile saved.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatar = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await api.uploadAvatar(file);
      await refreshUser();
      setProfileMessage('Profile picture updated.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not upload picture.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setPasswordMessage(result.message);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailMessage(null);
    setSavingEmail(true);
    try {
      const result = await api.changeEmail(newEmail.trim());
      setEmailMessage(result.message);
      setNewEmail('');
      await refreshUser();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Could not change email.');
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-5">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <UserRound className="w-4 h-4 text-primary" />
          <span>Profile</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Everything here is optional except display name when you save. You can keep using Aral.ai without filling this out.
        </p>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative group"
            title="Upload profile picture"
          >
            <UserAvatar user={user} size={72} />
            <span className="absolute inset-0 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </span>
          </button>
          <div>
            <p className="text-sm font-bold text-foreground">Profile picture</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Shown in the top-right nav once set.</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-2 text-xs font-bold text-primary hover:underline"
            >
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => void onAvatar(e.target.files?.[0])}
          />
        </div>

        <form onSubmit={(e) => void saveProfile(e)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="display-name" className="text-xs font-bold text-foreground">
              Display name
            </label>
            <input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="How you want to appear"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bio" className="text-xs font-bold text-foreground">
              Bio / background <span className="font-medium text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="A short note about what you study"
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="gender" className="text-xs font-bold text-foreground">
              Gender <span className="font-medium text-muted-foreground">(optional)</span>
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value || 'unset'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {profileError && <p className="text-xs text-destructive">{profileError}</p>}
          {profileMessage && <p className="text-xs text-sticker-green">{profileMessage}</p>}
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <span>Change password</span>
        </h2>
        <form onSubmit={(e) => void savePassword(e)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="current-password" className="text-xs font-bold text-foreground">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="text-xs font-bold text-foreground">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="text-xs font-bold text-foreground">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
          {passwordMessage && <p className="text-xs text-sticker-green">{passwordMessage}</p>}
          <button
            type="submit"
            disabled={savingPassword}
            className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {savingPassword ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="p-6 rounded-2xl bg-card border border-border shadow-notion-soft space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <span>Change email</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Current address: <span className="font-semibold text-foreground">{user?.email}</span>. A confirmation link is sent to the new address.
        </p>
        <form onSubmit={(e) => void saveEmail(e)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="new-email" className="text-xs font-bold text-foreground">
              New email
            </label>
            <input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@school.edu"
              className={inputClass}
            />
          </div>
          {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          {emailMessage && <p className="text-xs text-sticker-green">{emailMessage}</p>}
          <button
            type="submit"
            disabled={savingEmail || !newEmail.trim()}
            className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {savingEmail ? 'Sending…' : 'Change email'}
          </button>
        </form>
      </div>
    </div>
  );
}
