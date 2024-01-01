// Import types and APIs from graph-ts
import { BigInt, ByteArray, Bytes, crypto, ens } from "@graphprotocol/graph-ts";

import {
  byteArrayFromHex,
  checkValidLabel,
  concat,
  createEventID,
  EMPTY_ADDRESS,
  ROOT_NODE,
  REMILIAS_NODE,
  uint256ToByteArray,
} from "./utils";

// Import event types from the registry contract ABI
import {
  NameRegistered as NameRegisteredEvent,
  NameRenewed as NameRenewedEvent,
  Transfer as TransferEvent,
} from "./types/RemiliasRegistrar/RemiliasRegistrar";

import { NameRegistered as ControllerNameRegisteredEvent } from "./types/RemiliasRegistrarController/RemiliasRegistrarController";

// Import entity types generated from the GraphQL schema
import {
  Account,
  Domain,
  NameRegistered,
  NameRenewed,
  NameTransferred,
  Registration,
} from "./types/schema";

const BIG_INT_ZERO = BigInt.fromI32(0);
var rootNode: ByteArray = byteArrayFromHex(REMILIAS_NODE);

export function handleNameRegistered(event: NameRegisteredEvent): void {
  let account = new Account(event.params.owner.toHex());
  account.save();

  let label = uint256ToByteArray(event.params.id);
  let node = crypto.keccak256(concat(rootNode, label)).toHex();
  let domain = new Domain(node);
  domain.owner = account.id;
  domain.createdAt = event.block.timestamp;
  domain.registrant = account.id;
  domain.nftContract = event.params.nftContract;
  domain.nftId = event.params.nftId;
  domain.parent = rootNode.toHexString();
  // domain.labelhash = label;

  let registration = new Registration(label.toHex());

  registration.domain = domain.id;
  registration.registrationDate = event.block.timestamp;
  registration.registrant = account.id;
  registration.nftContract = event.params.nftContract;
  registration.nftId = event.params.nftId;

  let labelName = ens.nameByHash(label.toHexString());
  if (labelName === null) {
    labelName = "[" + event.params.id.toHexString().slice(2) + "]";
  }
  if (labelName != null) {
    domain.labelName = labelName;
    domain.name = labelName + "remilias.eth";
    registration.labelName = labelName;
  }

  domain.save();
  registration.save();

  let registrationEvent = new NameRegistered(createEventID(event));
  registrationEvent.registration = registration.id;
  registrationEvent.blockNumber = event.block.number.toI32();
  registrationEvent.transactionID = event.transaction.hash;
  registrationEvent.registrant = account.id;
  registrationEvent.save();
}

export function handleNameRegisteredByController(
  event: ControllerNameRegisteredEvent
): void {
  setNamePreimage(event.params.name, event.params.label);
}

function setNamePreimage(name: string, label: Bytes): void {
  if (!checkValidLabel(name)) {
    return;
  }

  let domain = Domain.load(crypto.keccak256(concat(rootNode, label)).toHex())!;
  if (domain.labelName !== name) {
    domain.labelName = name;
    domain.name = name + ".remilias.eth";
    domain.save();
  }

  let registration = Registration.load(label.toHex());
  if (registration == null) return;
  registration.labelName = name;
  registration.save();
}

export function handleNameTransferred(event: TransferEvent): void {
  let account = new Account(event.params.to.toHex());
  account.save();

  let label = uint256ToByteArray(event.params.tokenId);
  let registration = Registration.load(label.toHex());
  if (registration == null) return;

  let domain = Domain.load(crypto.keccak256(concat(rootNode, label)).toHex())!;

  registration.registrant = account.id;
  domain.registrant = account.id;
  domain.owner = account.id;

  domain.save();
  registration.save();

  let transferEvent = new NameTransferred(createEventID(event));
  transferEvent.registration = label.toHex();
  transferEvent.blockNumber = event.block.number.toI32();
  transferEvent.transactionID = event.transaction.hash;
  transferEvent.newOwner = account.id;
  transferEvent.save();
}
