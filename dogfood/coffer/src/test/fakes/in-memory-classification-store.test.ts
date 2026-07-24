import { describe } from 'vitest';
import { runClassificationStoreContract } from '../contracts/classification-store.contract.js';
import { InMemoryClassificationStoreAdapter } from './in-memory-classification-store.js';

describe('InMemoryClassificationStoreAdapter', () => {
	runClassificationStoreContract({ createStore: () => new InMemoryClassificationStoreAdapter() });
});
