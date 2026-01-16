'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
