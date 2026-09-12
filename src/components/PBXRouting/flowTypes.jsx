// Shared ReactFlow node + edge type maps, reused by the single-DID PBX routing
// view and the environment-wide Studio canvas so both render identical nodes.
import DIDNode from './nodes/DIDNode';
import QueueNode from './nodes/QueueNode';
import IVRNode from './nodes/IVRNode';
import CallConditionNode from './nodes/CallConditionNode';
import SimpleNode from './nodes/SimpleNode';
import ProviderNode from './nodes/ProviderNode';
import SubscriptionNode from './nodes/SubscriptionNode';
import TariffNode from './nodes/TariffNode';
import PBXEdge from './edges/PBXEdge';

const AnnouncementNode = (props) => <SimpleNode {...props} type="announcement" />;
const VMLNodeWrapper = (props) => <SimpleNode {...props} type="vml" />;
const BotNodeWrapper = (props) => <SimpleNode {...props} type="bot" />;
const ExtensionNodeWrapper = (props) => <SimpleNode {...props} type="extension" />;
const NumberNodeWrapper = (props) => <SimpleNode {...props} type="number" />;
const ConferenceNodeWrapper = (props) => <SimpleNode {...props} type="conference" />;
const UserLoginNodeWrapper = (props) => <SimpleNode {...props} type="user_login" />;

export const nodeTypes = {
  did: DIDNode,
  queue: QueueNode,
  ivr: IVRNode,
  call_condition: CallConditionNode,
  announcement: AnnouncementNode,
  vml: VMLNodeWrapper,
  bot: BotNodeWrapper,
  extension: ExtensionNodeWrapper,
  number: NumberNodeWrapper,
  conference: ConferenceNodeWrapper,
  user_login: UserLoginNodeWrapper,
  provider: ProviderNode,
  subscription: SubscriptionNode,
  tariff: TariffNode,
};

export const edgeTypes = {
  pbxEdge: PBXEdge,
};
