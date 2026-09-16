export type ToolchainNodeKind = 'package' | 'tool' | 'engine';
export type ToolchainDelivery = 'dependency' | 'bundled' | 'compiled';
export type ToolchainRelationship = 'depends-on' | 'bundles' | 'uses' | 'compiles';
export interface ToolchainNode {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly revision?: string;
  readonly builtAt?: string;
  readonly kind: ToolchainNodeKind;
  readonly delivery: readonly ToolchainDelivery[];
  readonly aliases: readonly string[];
}
export interface ToolchainEdge {
  readonly from: string;
  readonly to: string;
  readonly relationship: ToolchainRelationship;
}
export interface ToolchainManifest {
  readonly schemaVersion: 1;
  readonly nodes: readonly ToolchainNode[];
  readonly edges: readonly ToolchainEdge[];
}
export declare const toolchain: ToolchainManifest;
export default toolchain;
