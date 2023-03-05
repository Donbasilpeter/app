import {
  findEpochReportAccount,
  findImpactNFTMint,
  findImpactNFTMintAuthority,
  findLockAccount,
  findLockTokenAccount,
  type SunriseStakeConfig,
} from "./util";
import {
  Keypair,
  type PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  type Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { type LockAccount } from "./types/LockAccount";
import * as anchor from "@coral-xyz/anchor";
import { type Program } from "@coral-xyz/anchor";
import { type SunriseStake } from "./types/sunrise_stake";
import {
  type Account as TokenAccount,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type BN from "bn.js";
import { ImpactNftClient } from "@sunrisestake/impact-nft-client";
import { type EnvironmentConfig } from "./constants";

interface GetLockTokenAccountResult {
  address: PublicKey;
  account: TokenAccount | null; // null if not yet created
}
const getLockTokenAccount = async (
  config: SunriseStakeConfig,
  program: Program<SunriseStake>,
  authority: PublicKey
): Promise<GetLockTokenAccountResult> => {
  const [address] = findLockTokenAccount(config, authority);

  const account = await getAccount(program.provider.connection, address).catch(
    (e) => {
      // safer than instanceof
      if (e.name === "TokenAccountNotFoundError") return null;
      throw e;
    }
  );

  return { address, account };
};

export interface GetLockAccountResult {
  lockAccountAddress: PublicKey;
  tokenAccountAddress: PublicKey;
  lockAccount: LockAccount | null; // null if not yet created
  tokenAccount: TokenAccount | null; // null if not yet created
}
export const getLockAccount = async (
  config: SunriseStakeConfig,
  program: Program<SunriseStake>,
  authority: PublicKey
): Promise<GetLockAccountResult> => {
  const [lockAccountAddress] = findLockAccount(config, authority);

  const getLockTokenAccountPromise = getLockTokenAccount(
    config,
    program,
    authority
  );
  const fetchLockAccountPromise =
    program.account.lockAccount.fetchNullable(lockAccountAddress);

  const [
    { account: tokenAccount, address: tokenAccountAddress }, // getLockTokenAccountPromise
    account, // fetchLockAccountPromise
  ] = await Promise.all([getLockTokenAccountPromise, fetchLockAccountPromise]);

  if (!account)
    return {
      lockAccountAddress,
      tokenAccountAddress,
      lockAccount: null,
      tokenAccount: null,
    };

  const lockAccount = {
    address: lockAccountAddress,
    authority,
    lockTokenAccount: account.tokenAccount,
    startEpoch: account.startEpoch,
    updatedToEpoch: account.updatedToEpoch,
    stateAddress: account.stateAddress,
    sunriseYieldAtStart: account.sunriseYieldAtStart,
    yieldAccruedByOwner: account.yieldAccruedByOwner,
  };

  return { lockAccountAddress, tokenAccountAddress, lockAccount, tokenAccount };
};

export const lockGSol = async (
  config: SunriseStakeConfig,
  program: Program<SunriseStake>,
  authority: PublicKey,
  sourceGSolTokenAccount: PublicKey,
  impactNFTConfig: EnvironmentConfig["impactNFT"],
  lamports: BN
): Promise<Transaction> => {
  const { lockAccountAddress, tokenAccountAddress, lockAccount } =
    await getLockAccount(config, program, authority);
  const [epochReportAccount] = findEpochReportAccount(config);

  type Accounts = Parameters<
    ReturnType<typeof program.methods.lockGsol>["accounts"]
  >[0];

  const preInstructions: TransactionInstruction[] = [];

  const mintAuthority = findImpactNFTMintAuthority(config)[0];
  const mint = await findImpactNFTMint(config, authority)[0];
  const impactNftClient = await ImpactNftClient.get(
    config.impactNftStateAddress
  );
  const impactNftAccounts = impactNftClient.getMintNftAccounts(
    mint,
    authority // holder
  );

  const allImpactNFTAccounts = {
    impactNftProgram: impactNftAccounts.program,
    tokenMetadataProgram: impactNftAccounts.tokenMetadataProgram,
    impactNftState: config.impactNftStateAddress,
    nftMint: mint,
    nftMintAuthority: mintAuthority,
    nftMetadata: impactNftAccounts.metadata,
    nftHolderTokenAccount: impactNftAccounts.userTokenAccount,
    nftMasterEdition: impactNftAccounts.masterEdition,
    offsetMetadata: impactNftAccounts.offsetMetadata,
    offsetTiers: impactNftAccounts.offsetTiers,
  };

  // the user has never locked before - they need a lock account and a lock token account
  if (!lockAccount) {
    const initLockAccount = await program.methods
      .initLockAccount()
      .accounts({
        state: config.stateAddress,
        authority,
        gsolMint: config.gsolMint,
        lockAccount: lockAccountAddress,
        lockGsolAccount: tokenAccountAddress,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    preInstructions.push(initLockAccount);
  }

  const accounts: Accounts = {
    state: config.stateAddress,
    gsolMint: config.gsolMint,
    authority,
    sourceGsolAccount: sourceGSolTokenAccount,
    lockGsolAccount: tokenAccountAddress,
    lockAccount: lockAccountAddress,
    epochReportAccount,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
    ...allImpactNFTAccounts,
  };

  console.log("lockGSol accounts", accounts);

  return program.methods
    .lockGsol(lamports)
    .accounts(accounts)
    .preInstructions(preInstructions)
    .transaction();
};

export const updateLockAccount = async (
  config: SunriseStakeConfig,
  program: Program<SunriseStake>,
  authority: PublicKey
): Promise<Transaction> => {
  const [lockAccount] = findLockAccount(config, authority);
  const [lockGSolTokenAccount] = findLockTokenAccount(config, authority);
  const [epochReportAccount] = findEpochReportAccount(config);

  type Accounts = Parameters<
    ReturnType<typeof program.methods.updateLockAccount>["accounts"]
  >[0];

  const accounts: Accounts = {
    state: config.stateAddress,
    gsolMint: config.gsolMint,
    authority,
    lockGsolAccount: lockGSolTokenAccount,
    lockAccount,
    epochReportAccount,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
  };

  return program.methods.updateLockAccount().accounts(accounts).transaction();
};

export const unlockGSol = async (
  config: SunriseStakeConfig,
  program: Program<SunriseStake>,
  authority: PublicKey,
  targetGSolTokenAccount: PublicKey
): Promise<Transaction> => {
  const [lockAccount] = findLockAccount(config, authority);
  const [lockGSolTokenAccount] = findLockTokenAccount(config, authority);
  const [epochReportAccount] = findEpochReportAccount(config);

  type Accounts = Parameters<
    ReturnType<typeof program.methods.unlockGsol>["accounts"]
  >[0];

  const accounts: Accounts = {
    state: config.stateAddress,
    gsolMint: config.gsolMint,
    authority,
    targetGsolAccount: targetGSolTokenAccount,
    lockGsolAccount: lockGSolTokenAccount,
    lockAccount,
    epochReportAccount,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
  };

  return program.methods.unlockGsol().accounts(accounts).transaction();
};
