# Mealbook in ChatGPT: third-party remote MCP and Apps integration

**Research observation: 27 October 2026.** Mealbook can let eligible users reason over Mealbook data and invoke Mealbook tools from within ChatGPT, with Mealbook hosting its own MCP service, data, and identity layer. That is a ChatGPT app/plugin integration, not an instruction to put an OpenAI model key in Mealbook. However, it is **not** presently safe to promise this to every paid ChatGPT user or on every ChatGPT client. Current official support separates web workspace custom-MCP access from public-directory distribution, and both availability and controls can vary.

## What Mealbook would build

Expose a **remote MCP server** that offers narrowly scoped Mealbook tools, such as `search_meals`, `get_meal_plan`, `create_grocery_list`, and `update_saved_recipe`. ChatGPT connects to the server over a public HTTPS endpoint. The current developer deployment guide specifies **Streamable HTTP**, typically at `/mcp`, for a public endpoint; a Secure MCP Tunnel can reach a private stdio or HTTP server for development or private deployment. ChatGPT cannot directly connect to a local server; a tunnel is the documented path for a private, on-premises, or developer-machine server. [1] [2]

A tool-only MCP server is enough for conversational search and actions. OpenAI explicitly says a server can expose tools without a custom interface; an MCP app adds an interactive interface. Therefore, the Apps SDK is **not a prerequisite** for Mealbook’s data/tools integration. Use it only if Mealbook needs an in-chat UI such as a rich meal-plan card, recipe picker, or editable shopping-list component. The Apps SDK is currently preview software; OpenAI describes it as an MCP-based way to define app logic and UI, test through custom MCP setup, and later submit an app to the directory. [1] [3]

For user-specific Mealbook data or any write action, Mealbook should use OAuth 2.1 with least-privilege Mealbook scopes. The MCP host, ChatGPT, acts as the OAuth client on the user’s behalf. The service must expose protected-resource and authorization-server discovery metadata, support the authorization-code flow with PKCE `S256`, and choose a supported client-registration approach such as Client ID Metadata Documents or dynamic client registration. The server should distinguish scopes such as `meals:read`, `plans:write`, and `lists:write`; OAuth discovery makes these scopes intelligible to the user and administrator. Anonymous read-only tools are possible, but customer-specific data and writes should authenticate users. [4]

## Permissions, writes, and safety

ChatGPT permission settings control **when ChatGPT asks** before using an app’s existing access; they do not grant Mealbook extra service permissions. In the custom-MCP flow, ChatGPT can use write or modify actions, may ask for confirmation based on the app permissions and action context, and may block particularly risky actions. Mealbook should make every write tool explicit, narrowly scoped, idempotent where feasible, and transparent about the destination and effect. [1]

For an internal/custom connection, OpenAI makes the workspace responsible for vetting the server. Custom MCP servers can be built by Mealbook or by another party, but they are not automatically OpenAI-verified. OpenAI says registry apps are reviewed before they become available, while customers must verify the suitability of custom apps they build or add. This makes a Mealbook-operated, self-hosted server a normal architecture, but it also makes security review, OAuth scope design, prompt-injection defenses, and audit logging Mealbook responsibilities. [1]

## Availability and administration: what can and cannot be promised

For **custom remote MCP connections with full MCP support**, OpenAI’s current Help Center states availability for ChatGPT **Business and Enterprise/Edu on ChatGPT web**. Business permits only admins and owners to create and publish custom apps. On Enterprise/Edu, admins can grant selected members creation rights using RBAC, configure user/group access and action controls, and only admins/owners publish. The same document says Pro users can build with the Apps SDK and connect a custom MCP server with **read/fetch** permissions, but full MCP is currently limited to Business and Enterprise/Edu. It also says custom connections are **web only, not mobile**. [1]

The current Plugins UI says there is **no need to turn on Developer Mode** first: add the remote server from Plugins, acknowledge the risk warning, configure authentication, scan tools, and create the plugin. References to Developer Mode or legacy custom-app screens should therefore not be treated as a universal current requirement. [1]

There is no corresponding official assertion in these sources that a direct custom-MCP connection is supported in the native desktop client. Treat native-desktop access as unconfirmed until it is tested for the target account and documented by OpenAI. Likewise, the public app route should not be conflated with the direct custom-connection availability above. The Apps SDK documentation says Business and Enterprise/Edu are supported in its preview and that directory submission is a separate flow. It does not establish that every consumer plan, region, model, or interface receives a public Mealbook app on the same date. [3]

## Private deployment versus public directory listing

A Mealbook workspace deployment can be connected, tested, and published to that workspace without a public directory listing. The public directory is the distribution path for an app the developer wants people to discover more broadly: OpenAI says it is accepting submissions, while the Apps SDK workflow separates custom-MCP testing from the app-submission process. Thus, public listing is optional for a private Business/Enterprise/Edu rollout, but it is the appropriate path if Mealbook’s goal is broad consumer discovery. Directory submission brings OpenAI’s app standards into scope, including the draft developer-guideline requirements to follow usage policies, be appropriate for all audiences, and provide a clear privacy policy; OpenAI notes these early standards can change. [3]

For the Mealbook launch claim, the accurate wording is: **“Eligible ChatGPT users can connect or install Mealbook and reason over their Mealbook account inside ChatGPT, subject to their plan, client, region, workspace policies, OAuth authorization, and the app’s availability.”** Do not market it as available to every subscriber or as a mobile-native feature until those claims are separately validated.

## Keep the ChatGPT path separate from the Responses API path

The ChatGPT app/plugin path allows ChatGPT to be the AI host and Mealbook to host the data, tools, and user authorization. Provided Mealbook’s MCP service does not itself call OpenAI APIs, it does **not** need to keep an OpenAI API key merely to service tool calls from ChatGPT; it needs its own hosting and authentication infrastructure.

The **Responses API remote-MCP** path is different. Mealbook would make authenticated API requests to `/v1/responses`, choose the model, include the MCP server URL and tool policy, and pay API usage. The API guide supports both Streamable HTTP and HTTP/SSE remote MCP transports; it says usage is charged for tokens used to import definitions or make tool calls, with no separate per-tool-call fee. API-side controls include `allowed_tools` and `require_approval`, and the default is approval before data is shared. That path is useful if Mealbook is building its own agentic product, but it is developer-billed API usage, not the user’s ChatGPT subscription entitlement. [5]

**Practical recommendation:** start with a self-hosted, OAuth-protected, read-first remote MCP server; add clearly confirmed Mealbook writes after testing in a Business or Enterprise/Edu web workspace. Keep the Apps SDK UI optional. Pursue directory submission only when Mealbook is ready to meet public-facing policy, privacy, support, and rollout requirements.

**References**

[1]: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt "Connecting custom MCP servers in ChatGPT"

[2]: https://developers.openai.com/plugins/deploy/connect-chatgpt "Connect and test your plugin"

[3]: https://help.openai.com/en/articles/12515353-build-with-the-apps-sdk "Build with the Apps SDK"

[4]: https://developers.openai.com/plugins/build/auth "Authentication"

[5]: https://platform.openai.com/docs/guides/tools-remote-mcp "Remote MCP in the Responses API"
