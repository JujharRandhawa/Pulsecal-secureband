'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    // Redirect to dashboard
    router.push('/dashboard');
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontSize: '1rem',
      color: '#718096'
    }}>
      Loading...
    </div>
  );
}
