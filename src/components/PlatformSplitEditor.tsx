import React, { useState } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { Input } from './ui/Input';

export interface SplitRow {
  platform: string | null; // null = global default
  company: number;
  filmmaker: number;
}

interface Props {
  value: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
}

const KNOWN_PLATFORMS = [
  'Netflix', 'Amazon', 'Hulu', 'Apple TV+', 'Disney+', 'Peacock',
  'Paramount+', 'HBO Max', 'Tubi', 'Pluto TV', 'Vudu', 'YouTube',
  'Google Play', 'iTunes', 'Kanopy', 'Mubi', 'Other',
];

export function PlatformSplitEditor({ value, onChange }: Props) {
  const [newPlatform, setNewPlatform] = useState('');
  const [customPlatform, setCustomPlatform] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const globalRow = value.find(r => r.platform === null) ?? {
    platform: null,
    company: 25,
    filmmaker: 75,
  };
  const overrides = value.filter(r => r.platform !== null);

  const updateGlobal = (company: number) => {
    const filmmaker = Math.max(0, 100 - company);
    const next = value.filter(r => r.platform !== null);
    onChange([{ platform: null, company, filmmaker }, ...next]);
  };

  const updateOverride = (platform: string, company: number) => {
    const filmmaker = Math.max(0, 100 - company);
    onChange(value.map(r =>
      r.platform === platform ? { ...r, company, filmmaker } : r
    ));
  };

  const removeOverride = (platform: string) => {
    onChange(value.filter(r => r.platform !== platform));
  };

  const addOverride = (platform: string) => {
    const trimmed = platform.trim();
    if (!trimmed) return;
    if (value.some(r => r.platform === trimmed)) return;
    onChange([
      ...value,
      { platform: trimmed, company: globalRow.company, filmmaker: globalRow.filmmaker },
    ]);
    setNewPlatform('');
    setCustomPlatform('');
    setShowCustom(false);
  };

  const availablePlatforms = KNOWN_PLATFORMS.filter(
    p => !overrides.some(r => r.platform === p)
  );

  return (
    <div className="space-y-4">
      {/* Global default */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Global Default Split</p>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Info className="h-3 w-3" />
            Applied when no platform override exists
          </span>
        </div>
        <SplitRow
          company={globalRow.company}
          onChange={updateGlobal}
        />
      </div>

      {/* Per-platform overrides */}
      {overrides.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700">Platform Overrides</p>
          {overrides.map(row => (
            <div
              key={row.platform!}
              className="rounded-lg border border-blue-100 bg-blue-50 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">{row.platform}</span>
                <button
                  onClick={() => removeOverride(row.platform!)}
                  className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remove override"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <SplitRow
                company={row.company}
                onChange={(c) => updateOverride(row.platform!, c)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add override */}
      <div className="rounded-lg border border-dashed border-gray-300 p-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Add Platform Override
        </p>
        {!showCustom ? (
          <div className="flex items-center gap-2">
            <select
              value={newPlatform}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setShowCustom(true);
                  setNewPlatform('');
                } else {
                  setNewPlatform(e.target.value);
                }
              }}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select platform…</option>
              {availablePlatforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom__">Custom platform…</option>
            </select>
            <button
              onClick={() => addOverride(newPlatform)}
              disabled={!newPlatform}
              className="flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={customPlatform}
              onChange={e => setCustomPlatform(e.target.value)}
              placeholder="Platform name…"
              onKeyDown={e => e.key === 'Enter' && addOverride(customPlatform)}
            />
            <button
              onClick={() => addOverride(customPlatform)}
              disabled={!customPlatform.trim()}
              className="flex items-center gap-1 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              onClick={() => { setShowCustom(false); setCustomPlatform(''); }}
              className="px-3 py-2 rounded-md border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared split percentage input row ──────────────────────────────────────────
function SplitRow({ company, onChange }: { company: number; onChange: (c: number) => void }) {
  const filmmaker = Math.max(0, 100 - company);
  const valid = company >= 0 && company <= 100;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Nandar % (company)</label>
        <div className="relative">
          <input
            type="number"
            min={0}
            max={100}
            value={company}
            onChange={e => onChange(Math.min(100, Math.max(0, Number(e.target.value))))}
            className={`w-full rounded-md border px-3 py-2 text-sm pr-7 focus:outline-none focus:ring-1 ${
              valid
                ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                : 'border-red-400 focus:border-red-500 focus:ring-red-500'
            }`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-gray-400 mt-4">→</div>

      <div className="flex-1">
        <label className="block text-xs text-gray-500 mb-1">Filmmaker %</label>
        <div className="relative">
          <input
            type="number"
            value={filmmaker}
            readOnly
            className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm pr-7 text-gray-600 cursor-not-allowed"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
        </div>
      </div>
    </div>
  );
}
