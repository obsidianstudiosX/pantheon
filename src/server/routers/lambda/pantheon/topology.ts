/**
 * Pantheon topology tRPC router.
 *
 * Read-only visualization of the 26-agent Pantheon fabric. Consumed by
 * src/routes/(main)/(pantheon)/topology/. No database tenancy — just an
 * auth gate (`authedProcedure`) so the fabric topology is not leaked to
 * anonymous callers.
 *
 * ---------------------------------------------------------------------------
 *  Edge-derivation rules
 * ---------------------------------------------------------------------------
 *  (Mirrors the header of src/config/pantheon/registry.ts; kept here so the
 *  server-side layout code is self-documenting.)
 *
 *  1. Agency members → agency-lead
 *     Goddess members feed `liliweiss-goddess-lead`; valisword members feed
 *     `justia-valisword-lead`. Leads themselves are excluded.
 *
 *  2. Each lead → `crown`
 *     Both leads report up to `crown` (final-authority architecture).
 *
 *  3. eclipse-verifier → every agent with verify_required: true
 *     Emitted with `animated: true` and `style.strokeDasharray` so the
 *     verification mesh is visually distinct (dotted) from the authority DAG.
 *
 *  4. teresse-clinical → loen-ethics → crown
 *     Clinical escalation path (explicit, complements the generic
 *     valisword→crown route).
 *
 *  Layout: dagre, left-to-right, leads-on-top (ranker = longest-path so
 *  leads and crown always sit on the topmost rank).
 */

import Dagre from 'dagre';

import {
  getLeadOfAgency,
  getVerifyRequiredAgents,
  PANTHEON_AGENTS,
  type PantheonAgent,
} from '@/config/pantheon/registry';
import { authedProcedure, router } from '@/libs/trpc/lambda';

// ---------------------------------------------------------------------------
// React Flow v12 shapes. We intentionally don't import from @xyflow/react to
// keep this server-side file free of client-only code paths; the shapes match
// the subset the page consumes.
// ---------------------------------------------------------------------------

interface FabricNode {
  data: {
    agency: PantheonAgent['agency'];
    agentId: string;
    description: string;
    phiAware: boolean;
    port: number;
    role: string;
    verifyRequired: boolean;
  };
  id: string;
  position: { x: number; y: number };
  type: 'agent';
}

interface FabricEdge {
  animated?: boolean;
  id: string;
  source: string;
  style?: { strokeDasharray?: string };
  target: string;
  type?: 'default';
}

interface FabricGraph {
  edges: FabricEdge[];
  nodes: FabricNode[];
}

// Node sizing used for dagre measurement. Must match AgentNode.tsx visual box.
const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

const CROWN_ID = 'crown';
const ECLIPSE_ID = 'eclipse-verifier';
const TERESSE_ID = 'teresse-clinical';
const LOEN_ID = 'loen-ethics';

/**
 * Derive the raw (unpositioned) edge list from the registry per the rules
 * documented at the top of this file.
 */
const deriveEdges = (): FabricEdge[] => {
  const edges: FabricEdge[] = [];
  const seen = new Set<string>();
  const add = (edge: FabricEdge) => {
    if (seen.has(edge.id)) return;
    seen.add(edge.id);
    edges.push(edge);
  };

  const goddessLead = getLeadOfAgency('goddess');
  const valiswordLead = getLeadOfAgency('valisword');

  // Rule 1: agency members → lead
  for (const agent of PANTHEON_AGENTS) {
    if (agent.agency === 'goddess' && goddessLead && agent.agent_id !== goddessLead.agent_id) {
      // Crown feeds rule 2 (lead → crown) separately; skip double-arrow here.
      if (agent.agent_id === CROWN_ID) continue;
      add({
        id: `e:${agent.agent_id}->${goddessLead.agent_id}`,
        source: agent.agent_id,
        target: goddessLead.agent_id,
      });
    }
    if (
      agent.agency === 'valisword' &&
      valiswordLead &&
      agent.agent_id !== valiswordLead.agent_id
    ) {
      add({
        id: `e:${agent.agent_id}->${valiswordLead.agent_id}`,
        source: agent.agent_id,
        target: valiswordLead.agent_id,
      });
    }
  }

  // Rule 2: leads → crown
  if (goddessLead) {
    add({
      id: `e:${goddessLead.agent_id}->${CROWN_ID}`,
      source: goddessLead.agent_id,
      target: CROWN_ID,
    });
  }
  if (valiswordLead) {
    add({
      id: `e:${valiswordLead.agent_id}->${CROWN_ID}`,
      source: valiswordLead.agent_id,
      target: CROWN_ID,
    });
  }

  // Rule 3: eclipse-verifier → verify_required agents (dotted)
  const verifyTargets = getVerifyRequiredAgents().filter((a) => a.agent_id !== ECLIPSE_ID);
  for (const target of verifyTargets) {
    add({
      animated: true,
      id: `e:verify:${ECLIPSE_ID}->${target.agent_id}`,
      source: ECLIPSE_ID,
      style: { strokeDasharray: '4 4' },
      target: target.agent_id,
    });
  }

  // Rule 4: teresse-clinical → loen-ethics → crown (clinical escalation)
  add({
    id: `e:clinical:${TERESSE_ID}->${LOEN_ID}`,
    source: TERESSE_ID,
    target: LOEN_ID,
  });
  add({
    id: `e:clinical:${LOEN_ID}->${CROWN_ID}`,
    source: LOEN_ID,
    target: CROWN_ID,
  });

  return edges;
};

/**
 * Run dagre layout. Horizontal (rankdir LR) so leads render on the top
 * (rightmost/leftmost) rank depending on orientation — we use LR and then
 * readers parse left→right as "leaves feed leads feed crown".
 */
const layoutGraph = (nodes: FabricNode[], edges: FabricEdge[]): FabricNode[] => {
  const g = new Dagre.graphlib.Graph({ directed: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    nodesep: 32,
    rankdir: 'LR',
    ranker: 'longest-path',
    ranksep: 96,
  });

  for (const n of nodes) {
    g.setNode(n.id, { height: NODE_HEIGHT, width: NODE_WIDTH });
  }
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  Dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    // Dagre positions are center-of-node; React Flow uses top-left.
    return {
      ...n,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
};

const buildFabric = (): FabricGraph => {
  const baseNodes: FabricNode[] = PANTHEON_AGENTS.map((a) => ({
    data: {
      agency: a.agency,
      agentId: a.agent_id,
      description: a.description,
      phiAware: a.phi_aware === true,
      port: a.port,
      role: a.role,
      verifyRequired: a.verify_required === true,
    },
    id: a.agent_id,
    position: { x: 0, y: 0 },
    type: 'agent',
  }));

  const edges = deriveEdges();
  const nodes = layoutGraph(baseNodes, edges);
  return { edges, nodes };
};

export const topologyRouter = router({
  getFabric: authedProcedure.query(async () => buildFabric()),
});

export type TopologyRouter = typeof topologyRouter;
