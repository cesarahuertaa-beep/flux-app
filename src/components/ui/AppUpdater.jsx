import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Download, X } from 'lucide-react';
import { useBackButton } from '../../lib/backButtonHandler';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fluxsport.app';

export function AppUpdater() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const canDismiss = !updateInfo?.android?.forceUpdate && !updateInfo?.force;
  useBackButton(!dismissed && !!updateInfo && canDismiss, () => setDismissed(true), 150);

  useEffect(() => {
    const checkForUpdate = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const currentInfo = await App.getInfo();
        const currentVersion = currentInfo.version || '1.0.0';
        const res = await fetch('https://www.flux-sport.com/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = data.version || '1.0.0';

        const parseVer = (v) => String(v).split('.').map(n => parseInt(n, 10) || 0);
        const curParts = parseVer(currentVersion);
        const srvParts = parseVer(serverVersion);

        let isNewer = false;
        for (let i = 0; i < 3; i++) {
          if ((srvParts[i] || 0) > (curParts[i] || 0)) { isNewer = true; break; }
          if ((srvParts[i] || 0) < (curParts[i] || 0)) { break; }
        }

        if (isNewer) {
          setUpdateInfo(data);
        }
      } catch (err) {
        console.error('Error checking for updates: ', err);
      }
    };
    checkForUpdate();
  }, []);

  if (!updateInfo || dismissed) return null;

  const targetUrl = updateInfo.android?.playStoreUrl || PLAY_STORE_URL;

  return (
    <div className='fixed inset-0 z-[200] bg-[#0B1929]/60 backdrop-blur-sm flex items-center justify-center p-4'>
      <div className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative'>
        {!updateInfo.android?.forceUpdate && !updateInfo.force && (
          <button onClick={() => setDismissed(true)} className='absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer'>
            <X size={20} />
          </button>
        )}
        <div className='w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4'>
          <Download size={24} />
        </div>
        <h3 className='text-lg font-bold text-[#0B1929] mb-2'>Nueva actualización en Google Play</h3>
        <p className='text-sm text-gray-600 mb-6 leading-relaxed'>
          La versión <span className='font-bold text-[#0B1929]'>{updateInfo.version}</span> de FLUX ya está disponible en Google Play Store con nuevas mejoras.
        </p>
        <a
          href={targetUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='w-full flex items-center justify-center gap-2 bg-[var(--brand-primary)] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity'
        >
          Actualizar en Google Play
        </a>
      </div>
    </div>
  );
}
