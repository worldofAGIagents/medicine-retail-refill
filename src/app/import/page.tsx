'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ImportPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings?tab=import');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <p className="text-sm font-medium text-gray-700">Redirecting to MARG Data Import in Settings...</p>
      </div>
    </div>
  );
}
