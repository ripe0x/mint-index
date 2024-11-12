// Token data from contract
interface TokenData {
  name: string;
  description: string;
  mintedBlock: number;
  closeAt: number;
  mintOpenUntil: number;
  data?: string | number; // Optional as it might not always be used
}

// Metadata from URI
interface TokenMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: TokenAttribute[];
  // Add any other fields that might be in your metadata
  external_url?: string;
  animation_url?: string;
  background_color?: string;
}

// Individual attribute in metadata
interface TokenAttribute {
  trait_type: string;
  value: string | number;
  display_type?: string; // Optional, used for special display types like 'boost_percentage'
}

// Combined token information
interface TokenInfo {
  contractAddress: string;
  tokenId: number;
  tokenData: TokenData;
  metadata: TokenMetadata | null;
  loading: boolean;
  error: string | null;
}

// Props for Token component
interface TokenProps {
  contractAddress: string;
  tokenId: number;
}

// Props for CountdownTimer component
interface CountdownTimerProps {
  closeAt: number;
}

// Time left structure for countdown
interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export type {
  TokenData,
  TokenMetadata,
  TokenAttribute,
  TokenInfo,
  TokenProps,
  CountdownTimerProps,
  TimeLeft,
};
