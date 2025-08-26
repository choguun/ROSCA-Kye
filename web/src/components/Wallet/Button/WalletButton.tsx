/* GUIDELINE https://docs.dappportal.io/mini-dapp/design-guide#connect-button */
import styles from "./WalletButton.module.css";
import {Logo} from "@/components/Assets/Logo";
import {useKaiaWalletSdk} from "@/components/Wallet/Sdk/walletSdk.hooks";
import {useWalletAccountStore} from "@/components/Wallet/Account/auth.hooks";
import {Dispatch, SetStateAction, useState} from "react";
import * as Sentry from "@sentry/nextjs";

export type WalletButtonProps = {
  setIsLoggedIn:  Dispatch<SetStateAction<boolean>>;
}
export const WalletButton = ({setIsLoggedIn}:WalletButtonProps)=> {
  const { connectAndSign } = useKaiaWalletSdk();
  const { setAccount } = useWalletAccountStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {

    try {
      setIsConnecting(true);
      setError(null);
      console.log("Attempting to connect wallet...");
      
      const [account, signature] = await connectAndSign("connect");
      console.log("Wallet connected successfully:", account);
      console.log("Signature received:", !!signature);
      
      setAccount(account);
      setIsLoggedIn(true);
    }
    catch (error: unknown) {
      console.error("Wallet connection failed:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      console.error("Error JSON:", JSON.stringify(error, null, 2));
      
      // Report wallet button error to Sentry
      const errorToReport = error instanceof Error ? error : new Error(
        typeof error === 'string' ? error : 
        error?.message || 'Wallet button connection failed'
      );
      
      Sentry.captureException(errorToReport, {
        tags: {
          component: 'WalletButton',
          action: 'connect'
        },
        extra: {
          originalError: error,
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'server'
        }
      });
      
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle object errors (like axios errors or custom errors)
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if ('reason' in error && typeof error.reason === 'string') {
          errorMessage = error.reason;
        } else if ('code' in error) {
          errorMessage = `Error code: ${error.code}`;
        } else {
          errorMessage = 'Connection failed with unknown error';
        }
      }
      
      console.log("Processed error message:", errorMessage);
      
      if (errorMessage.includes('Failed to fetch') && 
          (errorMessage.includes('liffsdk.line-scdn.net') || errorMessage.includes('api.line.me'))) {
        setError("Network error: Cannot connect to LINE servers. Please check your internet connection and try refreshing the page.");
      } else if (errorMessage.includes('LIFF Network Connectivity Issue')) {
        setError("Connection issue with LINE platform. Please check your internet connection and try refreshing the page.");
      } else if (errorMessage.includes('Unexpected API name')) {
        setError("LINE platform initialization issue. Please refresh the page and try again.");
      } else if (errorMessage.includes('LIFF not ready')) {
        setError("LINE platform is not ready. Please refresh the page and try again.");
      } else if (errorMessage.includes('not initialized') || errorMessage.includes('KaiaWalletSdk is not initialized')) {
        setError("Wallet SDK not ready. Please refresh the page and try again.");
      } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
        setError("Connection rejected. Please try again.");
      } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
        setError("Access denied. Make sure you're using the app in LINE or on localhost:3000");
      } else if (errorMessage.includes('connect') || errorMessage.includes('wallet')) {
        setError(`Wallet connection failed: ${errorMessage}`);
      } else if (errorMessage === 'Unknown error occurred' || errorMessage === 'Connection failed with unknown error') {
        if (process.env.NEXT_PUBLIC_TEST_MODE === 'true') {
          setError("Connection failed. Test mode is enabled but wallet connection still failed. Check console for details.");
        } else {
          setError("Connection failed. This might be because you're not in a LINE environment. Please try opening the app in LINE or use localhost:3000 directly.");
        }
      } else {
        setError(`Connection failed: ${errorMessage}`);
      }
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div>
      <button 
        className={styles.root} 
        onClick={handleClick}
        disabled={isConnecting}
      >
        <Logo className={styles.icon}/>
        <p className={styles.description}>
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </p>
      </button>
      {error && (
        <div style={{ 
          color: '#e74c3c', 
          fontSize: '12px', 
          marginTop: '8px', 
          textAlign: 'center',
          maxWidth: '300px' 
        }}>
          {error}
        </div>
      )}
    </div>
  );
}