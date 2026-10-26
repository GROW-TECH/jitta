import React, { useState } from 'react';
import { Key, ShieldCheck, X, Check, Globe, Lock } from 'lucide-react';
import {
  getVehicleApiKey,
  setVehicleApiKey,
  getVehicleApiSecret,
  setVehicleApiSecret,
  getVehicleApiUrl,
  setVehicleApiUrl,
} from '../../services/vehicleInfoService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const VehicleApiKeyModal: React.FC<Props> = ({ isOpen, onClose, onSaved }) => {
  const [apiKey, setKey] = useState(getVehicleApiKey());
  const [apiSecret, setSecret] = useState(getVehicleApiSecret());
  const [apiUrl, setUrl] = useState(getVehicleApiUrl());
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setVehicleApiKey(apiKey);
    setVehicleApiSecret(apiSecret);
    setVehicleApiUrl(apiUrl);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      if (onSaved) onSaved();
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl border border-gray-100 text-[#171717] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#E85D04] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#171717]">Vehicle Info API Key & Secret</h3>
              <p className="text-[10px] text-gray-500">Configure custom RTO / RC Lookup API Credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              API Key / Client ID (RapidAPI / Surepass / Custom)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your API Key / Client ID here…"
              className="w-full bg-[#FAFAF8] border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-900 outline-none focus:border-[#E85D04]"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Leave blank to use intelligent RTO parser with automatic model detection.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-gray-500" /> API Secret / Client Secret (Optional)
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste your API Secret (if your provider requires it)…"
              className="w-full bg-[#FAFAF8] border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-900 outline-none focus:border-[#E85D04]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Globe className="w-3 h-3 text-gray-500" /> Custom API Endpoint URL (Optional)
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-api.com/rc-details"
              className="w-full bg-[#FAFAF8] border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono text-gray-900 outline-none focus:border-[#E85D04]"
            />
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              Your API key is securely stored in your local browser and sent directly to verify vehicle RC details.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 bg-[#E85D04] hover:bg-[#C2410C] text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : (
              'Save API Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
