# Claude app/client support for a third-party remote MCP connector

**Research date:** October 27, 2026
**Author:** Manus AI

Mealbook can support a user-owned Claude experience without embedding an Anthropic chat UI or operating an Anthropic API-backed chat service. The applicable path is a **remote MCP custom connector**: Mealbook hosts a public remote MCP server, and each person adds its URL to their own Claude account and authorizes it. This is a Claude consumer-product connection that runs under the user’s Claude plan, rather than a Messages API integration run under Mealbook’s API account. [1] [2]

## What the Claude consumer connector supports

Custom connectors using remote MCP are available to Free, Pro, Max, Team, and Enterprise users; Free users may add one custom connector. Anthropic states that remote servers connect through its cloud infrastructure across Claude clients, including claude.ai, Claude Desktop, Cowork, and mobile apps. The general connector guide describes mobile installation as beta and says web and Desktop remain the primary setup path for custom connectors. [1] [2]

For Mealbook, host a publicly reachable HTTPS remote MCP server. Streamable HTTP is the recommended remote transport; legacy HTTP+SSE is still supported. The server is called by Anthropic’s cloud, not from a user’s laptop or phone, so it cannot be only on a private network, behind an unallowlisted firewall, or reachable solely over a VPN. [1] [3]

A consumer connector can expose MCP **tools, prompts, and resources**, with text and image tool results and text or binary resources. Claude does not yet support resource subscriptions, sampling, or advanced/draft MCP capabilities. For hosted Claude surfaces, Anthropic documents an approximately 150,000-character maximum tool result and a 240-second tool-call timeout. [3]

## Authentication, authorization, and permissions

A user adds the endpoint under **Customize → Connectors → Add → Custom → Web**. Claude detects the server’s authentication settings for review, then the user or organization chooses whether to sign in immediately, sign in when needed, or use no sign-in. For OAuth, Claude can identify itself with Anthropic’s published client identity, Dynamic Client Registration, or a developer-supplied OAuth client. [1]

A Mealbook OAuth implementation should be the normal path: Claude supports the relevant MCP OAuth authorization specifications, supports Dynamic Client Registration, uses a hosted-surface callback of `https://claude.ai/api/mcp/auth_callback`, and refreshes access tokens. The user sees and grants the scopes requested by Mealbook; Claude then acts only with the permissions available to that person in Mealbook. Anthropic says connectors inherit source-system permissions and do not extend them. [2] [3]

Claude also permits a fixed API key, bearer token, or other static credential to be configured as a request header. That value is encrypted by Claude, but on Team and Enterprise a shared credential gives every user of the connector whatever access that credential has. This is therefore a poor default for Mealbook if the design goal is per-user access and no shared provider key. Use user OAuth with minimal scopes instead. [1]

Users can enable or disable a connector per conversation. They can review tool approvals and avoid “Allow always” for untrusted tools. Team and Enterprise owners can narrow or block individual read/write tool actions across the organization; this only reduces, never expands, source-system permissions. [1] [2]

## Distribution does not require the marketplace

A Connector Directory listing is **not required**. A user, or a Team/Enterprise owner, can enter Mealbook’s remote URL as a custom connector without Anthropic review. This is the fastest distribution route for an initial controlled rollout. [3]

Directory publication is optional and is for discoverability inside Claude. It requires a remote HTTPS server, a paid Claude plan for the submitter, working Claude-compatible authentication, tool titles and read-only/destructive annotations, documentation, privacy details, test access for reviewers, and compliance with directory requirements. Anthropic scans submissions and may conduct human review; a custom URL connection and a directory connector run on the same underlying infrastructure. [3] [4]

## Important behavior and support caveats

Custom MCP servers are not necessarily verified by Anthropic. Anthropic warns that a server developer can change tool behavior unexpectedly, and a malicious server may use tool descriptions or results for prompt-injection attempts. Mealbook should publish stable tool names and scopes, document all write/destructive actions, minimize requested permissions, and treat a server behavior change as a user-impacting release. [1]

The remote endpoint must remain publicly reachable from Anthropic’s cloud. This applies even when the person uses Desktop or Cowork locally. It is an operational dependency for Mealbook, not something a user can solve by having local network access. [1]

Mobile custom-connector installation remains beta, so Mealbook should make the web/Desktop setup path the documented primary route and present mobile availability as subject to Claude’s current rollout. Availability, UI wording, plan limits, and MCP support can change as Anthropic updates the product. [2]

## Do not confuse this with the Claude API MCP connector

The **Claude API MCP connector** is a different developer feature. Mealbook would call the Messages API with its own `ANTHROPIC_API_KEY`, provide the MCP URL and any `authorization_token`, and operate the conversation flow itself. It is currently beta. The API consumer—not the end user’s Claude subscription—is the account context for those API requests; calling this “operator-billed” is accurate only when Mealbook controls that API account. [5]

The distinction matters for the stated product goal. The API MCP connector supports only remote-server **tool calls**, not MCP prompts or resources. Its caller must obtain OAuth access tokens before an API request and refresh them as needed, which places authorization-token handling in Mealbook’s developer architecture. It also requires public HTTP with Streamable HTTP or SSE, excludes local STDIO servers, is not eligible for Zero Data Retention, and retains exchanged tool definitions and execution results under Anthropic’s standard data-retention policy. [5]

The API connector also permits server tool lists to change dynamically. Anthropic offers a separate API beta to pin a returned tool list so a mid-conversation server change does not alter what Claude receives. That pinning documentation is API-specific; it should not be assumed to describe the consumer Claude connector’s controls. [5]

## Bottom line for Mealbook

The recommended fit is a public, OAuth-protected remote MCP server that each Mealbook user connects from their own Claude account. It avoids embedded chat and avoids Mealbook holding an Anthropic model API key for those user conversations. Mealbook still needs to operate its own service and user authorization model, and users still grant Mealbook-scoped OAuth access through Claude; “no provider keys” should mean no shared static connector credential and no Mealbook-operated Anthropic API chat path.

Start as an unlisted custom connector: publish the endpoint and concise web/Desktop setup instructions, let users authenticate with their own Mealbook accounts, and constrain the first tool set to clearly described, least-privilege actions. Add a directory submission later only if in-product discovery is valuable.

## References

[1]: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp "Get started with custom connectors using remote MCP"

[2]: https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities "Use connectors to extend Claude capabilities"

[3]: https://claude.com/docs/connectors/building "Build an MCP server for Claude"

[4]: https://claude.com/docs/connectors/building/submission "Submit a connector to the directory"

[5]: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector "MCP connector"
