"use client";

// Freighter Mobile connects to dapps through WalletConnect v2. The browser-extension
// API deliberately reports "not installed" on iPhone/Android, even inside Freighter's
// Discover browser, so mobile must use this separate transport.

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
const STELLAR_TESTNET_CHAIN = "stellar:testnet";
const REQUIRED_METHODS = ["stellar_signXDR", "stellar_signMessage"];
const TRANSPORT_KEY = "crownfi.walletTransport";

let connection: Promise<{ provider: any; modal: any }> | null = null;

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as any).message);
  return typeof error === "string" ? error : "Freighter Mobile connection failed.";
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const stellarMobile = (window as any).stellar?.platform === "mobile";
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return stellarMobile || mobileUa || touchMac;
}

export function mobileFreighterConfigured(): boolean {
  return Boolean(PROJECT_ID);
}

export function shouldUseFreighterMobile(): boolean {
  if (typeof window === "undefined") return false;
  return isMobileDevice() || localStorage.getItem(TRANSPORT_KEY) === "walletconnect";
}

async function initialize() {
  if (!PROJECT_ID) {
    throw new Error("Freighter Mobile needs WalletConnect to be enabled. Continue with Google for now.");
  }
  if (!connection) {
    connection = (async () => {
      const [{ UniversalProvider }, { createAppKit }, { defineChain }] = await Promise.all([
        import("@walletconnect/universal-provider"),
        import("@reown/appkit/core"),
        import("@reown/appkit/networks"),
      ]);
      const stellarTestnet = defineChain({
        id: "testnet",
        name: "Stellar Testnet",
        nativeCurrency: { name: "Lumens", symbol: "XLM", decimals: 7 },
        rpcUrls: { default: { http: ["https://soroban-testnet.stellar.org"] } },
        blockExplorers: {
          default: { name: "Stellar Expert", url: "https://stellar.expert/explorer/testnet" },
        },
        testnet: true,
        chainNamespace: "stellar",
        caipNetworkId: STELLAR_TESTNET_CHAIN,
      } as any);
      const provider = await UniversalProvider.init({
        projectId: PROJECT_ID,
        metadata: {
          name: "CrownFi",
          description: "Stellar pageant predictions and fan experiences",
          url: window.location.origin,
          icons: [`${window.location.origin}/icon.png`],
        },
      });
      const modal = createAppKit({
        projectId: PROJECT_ID,
        networks: [stellarTestnet as any],
        universalProvider: provider as any,
        manualWCControl: true,
      });
      return { provider, modal };
    })().catch((error) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

function addressFromSession(session: any): string | null {
  const account = session?.namespaces?.stellar?.accounts?.find((value: unknown) =>
    typeof value === "string" && value.startsWith(`${STELLAR_TESTNET_CHAIN}:G`)
  );
  const address = typeof account === "string" ? account.split(":")[2] : "";
  return /^G[A-Z2-7]{55}$/.test(address) ? address : null;
}

async function activeProvider() {
  const { provider } = await initialize();
  if (!provider.session || !addressFromSession(provider.session)) {
    throw new Error("Your Freighter Mobile session expired. Connect the wallet again.");
  }
  return provider;
}

export async function connectFreighterMobile(): Promise<{ address?: string; error?: string }> {
  try {
    const { provider, modal } = await initialize();
    let session = provider.session;
    if (!session || !addressFromSession(session)) {
      void modal.open();
      session = await provider.connect({
        namespaces: {
          stellar: {
            methods: ["stellar_signXDR", "stellar_signAndSubmitXDR", "stellar_signMessage", "stellar_signAuthEntry"],
            chains: [STELLAR_TESTNET_CHAIN],
            events: ["accountsChanged"],
          },
        },
      });
      modal.close();
    }

    const address = addressFromSession(session);
    const methods: string[] = session?.namespaces?.stellar?.methods ?? [];
    if (!address) throw new Error("Freighter Mobile must be connected to Stellar Testnet.");
    if (!REQUIRED_METHODS.every((method) => methods.includes(method))) {
      throw new Error("This Freighter Mobile session cannot sign CrownFi predictions. Update Freighter and reconnect.");
    }
    localStorage.setItem(TRANSPORT_KEY, "walletconnect");
    return { address };
  } catch (error) {
    try { (await initialize()).modal.close(); } catch { /* nothing to close */ }
    return { error: errorMessage(error) };
  }
}

export async function signFreighterMobileMessage(message: string): Promise<{ signature?: string; error?: string }> {
  try {
    const provider = await activeProvider();
    const result = await provider.request({ method: "stellar_signMessage", params: { message } }, STELLAR_TESTNET_CHAIN);
    const signature = result?.signature;
    return typeof signature === "string" && signature ? { signature } : { error: "Freighter Mobile returned no signature." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function signWithFreighterMobile(xdr: string): Promise<{ signedXdr?: string; error?: string }> {
  try {
    const provider = await activeProvider();
    const result = await provider.request({ method: "stellar_signXDR", params: { xdr } }, STELLAR_TESTNET_CHAIN);
    const signedXdr = result?.signedXDR;
    return typeof signedXdr === "string" && signedXdr ? { signedXdr } : { error: "Freighter Mobile returned no signed transaction." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function disconnectFreighterMobile(): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TRANSPORT_KEY);
  if (!connection || !PROJECT_ID) return;
  try {
    const { provider } = await connection;
    if (provider.session) await provider.disconnect();
  } catch {
    // The CrownFi session can still be cleared even if the wallet session already expired.
  }
}
