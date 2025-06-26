import { ethers } from 'ethers';

export interface AirdropEntry {
  address: string;
  amount: string;
}

export class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(elements: AirdropEntry[]) {
    this.leaves = elements.map(el => 
      ethers.keccak256(ethers.solidityPacked(['address', 'uint256'], [el.address, el.amount]))
    ).sort();
    
    this.layers = this.getLayers(this.leaves);
  }

  private getLayers(elements: string[]): string[][] {
    if (elements.length === 0) {
      return [['']];
    }

    const layers = [];
    layers.push(elements);

    while (layers[layers.length - 1].length > 1) {
      layers.push(this.getNextLayer(layers[layers.length - 1]));
    }

    return layers;
  }

  private getNextLayer(elements: string[]): string[] {
    return elements.reduce<string[]>((layer, el, idx, arr) => {
      if (idx % 2 === 0) {
        // Hash the current element with the next one (or with itself if it's the last)
        const nextEl = idx + 1 < arr.length ? arr[idx + 1] : el;
        const combined = el.localeCompare(nextEl) < 0 ? el + nextEl.slice(2) : nextEl + el.slice(2);
        layer.push(ethers.keccak256('0x' + combined));
      }
      return layer;
    }, []);
  }

  public getRoot(): string {
    return this.layers[this.layers.length - 1][0] || '';
  }

  public getProof(leaf: string): string[] {
    let idx = this.leaves.indexOf(leaf);
    if (idx === -1) {
      throw new Error('Element not found in tree');
    }

    const proof = [];
    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRightNode = idx % 2;
      const pairIdx = isRightNode ? idx - 1 : idx + 1;

      if (pairIdx < layer.length) {
        proof.push(layer[pairIdx]);
      }

      idx = Math.floor(idx / 2);
    }

    return proof;
  }

  public verify(proof: string[], root: string, leaf: string): boolean {
    let hash = leaf;

    for (const proofElement of proof) {
      if (hash.localeCompare(proofElement) < 0) {
        hash = ethers.keccak256(hash + proofElement.slice(2));
      } else {
        hash = ethers.keccak256(proofElement + hash.slice(2));
      }
    }

    return hash === root;
  }

  public static getLeaf(address: string, amount: string): string {
    return ethers.keccak256(ethers.solidityPacked(['address', 'uint256'], [address, amount]));
  }
}

export function generateMerkleTree(recipients: AirdropEntry[]): {
  root: string;
  tree: MerkleTree;
  proofs: Record<string, string[]>;
} {
  const tree = new MerkleTree(recipients);
  const root = tree.getRoot();
  
  const proofs: Record<string, string[]> = {};
  recipients.forEach(recipient => {
    const leaf = MerkleTree.getLeaf(recipient.address, recipient.amount);
    proofs[recipient.address.toLowerCase()] = tree.getProof(leaf);
  });

  return { root, tree, proofs };
}