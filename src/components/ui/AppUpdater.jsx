import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Download, X } from 'lucide-react';

export function AppUpdater() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkForUpdate = async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        const currentInfo = await App.getInfo();
        const currentVersion = currentInfo.version;
        const res = await fetch('https://www.flux-sport.com/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();

        const isNewer = data.version.localeCompare(currentVersion, undefined, { numeric: true, sensitivity: 'base' }) > 0;
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

  return (
    <div className='fixed inset-0 z-[200] bg-[#0B1929]/60 backdrop-blur-sm flex items-center justify-center p-4'>
      <div className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl relative'>
        {!updateInfo.android?.forceUpdate && (
          <button onClick={() => setDismissed(true)} className='absolute top-4 right-4 text-gray-400 hover:text-gray-600'>
            <X size={20} />
          </button>
        )}
        <div className='w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4'>
          <Download size={24} />
        </div>
        <h3 className='text-lg font-bold text-[#0B1929] mb-2'>Nueva versión disponible</h3>
        <p className='text-sm text-gray-600 mb-6'>
          La versión {updateInfo.version} de FLUX ya está disponible. Te recomendamos actualizar para disfrutar de las últimas mejoras.
        </p>
        <a 
          href={updateInfo.android?.downloadUrl || 'https://www.flux-sport.com/FLUX.apk'}
          target='_blank'
          className='w-full flex items-center justify-center gap-2 bg-[#1A6FD4] text-white py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors'
        >
          Descargar actualización
        </a>
      </div>
    </div>
  );
}
