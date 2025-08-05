// config/index.tsx
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage } from "wagmi";
import { monadTestnet } from '@reown/appkit/networks';
import nftAbi from '../app/abis/CatcentsNFT.json';
import stakingAbi from '../app/abis/NFTStaking.json';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

export const networks = [monadTestnet];

if (!projectId) throw new Error("Project ID is not defined");

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  networks,
  projectId,
});

export const config = {
  ...wagmiAdapter.wagmiConfig,
  contracts: [
    {
      name: 'CatcentsNFT',
      abi: nftAbi,
      address: '0xfa28a33f198dc84454881fbb14c9d69dea97efdb', // Update with correct Monad Testnet address
    },
    {
      name: 'NFTStaking',
      abi: stakingAbi,
      address: '0xa2358D0a32B6a9B5dfee6c59C867F69BB628183e', // Update with correct Monad Testnet address
    },
  ],
};

export default config;