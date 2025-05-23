import {
  SHIPBroadcaster,
  LookupResolver,
  Transaction,
  Utils,
  ProtoWallet,
  WalletClient,
  SHIPBroadcasterConfig,
  HTTPSOverlayBroadcastFacilitator
} from '@bsv/sdk';
import { bsv, toByteString } from 'scrypt-ts';
import { BountyContract, BountyArtifact } from '@bsv/backend';

// Initialize smart contract
BountyContract.loadArtifact(BountyArtifact);

// Protowallet to verify signature
export const anyoneWallet = new ProtoWallet('anyone');

// Initialize wallet client
export const walletClient = new WalletClient('auto');

// Initialize overlay services
export const lookupResolver = new LookupResolver({ networkPreset: 'local' });

const args: SHIPBroadcasterConfig = {
  networkPreset: 'local'
}

const broadcaster = new SHIPBroadcaster(['tm_bounty'], args)

// Configure API endpoints
export const apiEndpoints = {
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.gitpaid.app' 
    : '',  // Empty string uses proxy in webpack dev server
  github: {
    auth: '/auth/github',
    callback: '/auth/github/callback'
  },
  repositories: '/api/repositories',
  issues: (owner: string, repo: string) => `/api/repositories/${owner}/${repo}/issues`,
  bounties: {
    create: '/api/bounties',
    funded: '/api/bounties/funded',
    wallet: '/api/wallet/balance'
  }
};

// Configure BSV network settings
export const bsvNetwork = {
  network: process.env.NODE_ENV === 'production' ? 'main' : 'local',
  satoshisPerByte: 0.5, // Default fee rate
  minSatoshisPerBounty: 1000, // Minimum bounty amount
  wocApiEndpoint: 'https://api.whatsonchain.com/v1/bsv/main'
};

// Define blockchain topics for overlay network
export const overlayTopics = {
  bounty: 'tm_bounty'
};

// Define lookup services
export const lookupServices = {
  bounty: 'ls_bounty'
};