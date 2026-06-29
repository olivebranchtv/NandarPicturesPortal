import React, { useState, useRef } from 'react';
import { X, Upload, Film, Link, Users, FileText, Star, Clock, Calendar, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { supabase, Content } from '../lib/supabase';

interface Props {
  title: Content;
  onClose: () => void;
  onSaved: (updated: Partial<Content>) => void;
}

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Fantasy', 'Horror', 'Musical', 'Mystery', 'Romance',
  'Sci-Fi', 'Thriller', 'Western', 'Other',
];

const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'NR', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];

export function TitleMetadataModal({ title, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    description: title.description ?? '',
    genre: title.genre ?? '',
    release_date: title.release_date ?? '',
    duration_minutes: title.duration_minutes?.toString() ?? '',
    rating: title.rating ?? '',
    cast_list: title.cast_list ?? '',
    trailer_url: title.trailer_url ?? '',
  });
  const [coverArtUrl, setCoverArtUrl] = useState<string | null>(title.cover_art_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${title.id}/cover.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('title-cover-art')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('title-cover-art').getPublicUrl(path);
      // Bust cache with timestamp so updated image shows immediately
      setCoverArtUrl(`${data.publicUrl}?t=${Date.now()}`);
      toast.success('Cover art uploaded.');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveCoverArt = async () => {
    if (!supabase || !coverArtUrl) return;
    // Best-effort delete; ignore errors if file doesn't exist
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    for (const ext of extensions) {
      await supabase.storage.from('title-cover-art').remove([`${title.id}/cover.${ext}`]);
    }
    setCoverArtUrl(null);
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      const updates: Partial<Content> = {
        description: form.description || undefined,
        genre: form.genre || undefined,
        release_date: form.release_date || undefined,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
        rating: form.rating || undefined,
        cast_list: form.cast_list || undefined,
        trailer_url: form.trailer_url || undefined,
        cover_art_url: coverArtUrl ?? undefined,
      };

      const { error } = await supabase
        .from('content')
        .update(updates)
        .eq('id', title.id);

      if (error) throw error;

      toast.success('Title info saved.');
      onSaved({ ...updates, cover_art_url: coverArtUrl ?? undefined });
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Title Info</h2>
            <p className="text-sm text-gray-500 truncate max-w-sm">{title.title_name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Cover Art */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Film className="h-4 w-4 text-blue-600" /> Cover Art
            </h3>
            <div className="flex items-start gap-4">
              {/* Preview */}
              <div className="relative flex-shrink-0 w-28 h-40 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                ) : coverArtUrl ? (
                  <>
                    <img src={coverArtUrl} alt="Cover art" className="absolute inset-0 w-full h-full object-cover" />
                    <button
                      onClick={handleRemoveCoverArt}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded text-white hover:bg-black/80 transition-colors"
                      title="Remove cover art"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <Film className="h-8 w-8 text-gray-300" />
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-3">
                  Upload a poster or thumbnail image. Recommended: 2:3 ratio (e.g. 400×600 px). Max 5 MB.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Choose Image'}
                </Button>
                <p className="text-xs text-gray-400 mt-2">JPG, PNG, WebP or GIF</p>
              </div>
            </div>
          </section>

          {/* Synopsis */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" /> Synopsis
            </h3>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Write a short synopsis of the film…"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </section>

          {/* Genre + Rating row */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Film className="h-4 w-4 text-blue-600" /> Genre
              </label>
              <select
                value={form.genre}
                onChange={e => set('genre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select genre</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Star className="h-4 w-4 text-blue-600" /> Rating
              </label>
              <select
                value={form.rating}
                onChange={e => set('rating', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select rating</option>
                {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </section>

          {/* Release date + Duration row */}
          <section className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" /> Release Date
              </label>
              <input
                type="date"
                value={form.release_date}
                onChange={e => set('release_date', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" /> Runtime (minutes)
              </label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => set('duration_minutes', e.target.value)}
                placeholder="e.g. 95"
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </section>

          {/* Cast */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Cast
            </h3>
            <Input
              value={form.cast_list}
              onChange={e => set('cast_list', e.target.value)}
              placeholder="e.g. Jane Doe, John Smith, Maria Garcia"
            />
            <p className="text-xs text-gray-400 mt-1.5">Separate names with commas</p>
          </section>

          {/* Trailer */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Link className="h-4 w-4 text-blue-600" /> Trailer Link
            </h3>
            <Input
              type="url"
              value={form.trailer_url}
              onChange={e => set('trailer_url', e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
