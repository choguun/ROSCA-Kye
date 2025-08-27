"use client";

import { useEffect, useState } from 'react';

export function ErudaFixed() {
  const [erudaLoaded, setErudaLoaded] = useState(false);
  const [erudaVisible, setErudaVisible] = useState(false);

  useEffect(() => {
    // Simple and safe Eruda loading
    if (typeof window !== 'undefined') {
      const loadEruda = async () => {
        try {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/eruda@3.4.3/eruda.js';
          script.async = true;
          script.onload = () => {
            try {
              if ((window as any).eruda) {
                (window as any).eruda.init();
                setErudaLoaded(true);
                console.log('✅ Eruda loaded successfully');
              }
            } catch (e) {
              console.error('Eruda init error:', e);
            }
          };
          document.head.appendChild(script);
        } catch (error) {
          console.error('Failed to load Eruda:', error);
        }
      };

      // Load Eruda after a short delay to ensure page is ready
      setTimeout(loadEruda, 1000);
    }
  }, []);

  const toggleEruda = () => {
    if ((window as any).eruda) {
      try {
        if (erudaVisible) {
          (window as any).eruda.hide();
          setErudaVisible(false);
          console.log('🔧 Eruda hidden');
        } else {
          (window as any).eruda.show();
          setErudaVisible(true);
          console.log('🔧 Eruda shown');
        }
      } catch (e) {
        console.error('Error toggling Eruda:', e);
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {erudaLoaded && (
        <button
          onClick={toggleEruda}
          style={{
            background: erudaVisible ? '#dc3545' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            width: '50px',
            height: '50px',
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={erudaVisible ? 'Hide Eruda' : 'Show Eruda'}
        >
          {erudaVisible ? '👁️‍🗨️' : '👁️'}
        </button>
      )}
      
      <button
        onClick={() => {
          console.log('🔧 Console test - this message should appear');
          console.error('🔧 Error test - red message');
          console.warn('🔧 Warning test - yellow message');
          alert('Check browser console (F12) for test messages');
        }}
        style={{
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          width: '50px',
          height: '50px',
          fontSize: '16px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Test Console"
      >
        📝
      </button>
      
      {!erudaLoaded && (
        <div style={{
          background: '#ffc107',
          color: '#000',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          maxWidth: '200px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          🔧 Loading Eruda...
        </div>
      )}
    </div>
  );
}