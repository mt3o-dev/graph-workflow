import { describe } from 'vitest';
import { runStoreContract } from '../contracts/store.contract.js';
import { InMemoryStoreAdapter } from './in-memory-store.js';

describe('InMemoryStoreAdapter', () => {
	runStoreContract({ createStore: () => new InMemoryStoreAdapter() });
});
