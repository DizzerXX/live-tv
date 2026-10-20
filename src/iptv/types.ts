/**
 * Subset of the iptv-org API schema this addon relies on.
 * Reference: https://github.com/iptv-org/api
 */

export interface IptvChannel {
  readonly id: string;
  readonly name: string;
  readonly country: string;
  readonly categories: readonly string[];
  readonly is_nsfw: boolean;
  readonly closed: string | null;
  readonly website: string | null;
}

export interface IptvFeed {
  readonly channel: string;
  readonly id: string;
  readonly is_main: boolean;
  readonly languages: readonly string[];
}

export interface IptvStream {
  readonly channel: string | null;
  readonly feed: string | null;
  readonly title: string;
  readonly url: string;
  readonly referrer: string | null;
  readonly user_agent: string | null;
  readonly quality: string | null;
  readonly labels: readonly string[];
}

export interface IptvLogo {
  readonly channel: string;
  readonly feed: string | null;
  readonly in_use: boolean;
  readonly width: number;
  readonly height: number;
  readonly format: string | null;
  readonly url: string;
}

export interface IptvBlocklistEntry {
  readonly channel: string;
  readonly reason: string;
}

export interface IptvDataset {
  readonly channels: readonly IptvChannel[];
  readonly feeds: readonly IptvFeed[];
  readonly streams: readonly IptvStream[];
  readonly logos: readonly IptvLogo[];
  readonly blocklist: readonly IptvBlocklistEntry[];
}
