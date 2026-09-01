## API 密钥

本项目用到：

- `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`

密钥**不在全局环境变量里**。值存放在 `~/.secrets/`（权限 600），
由本目录的 `.envrc` + direnv 按需加载，离开目录自动卸载。

**写代码时**：照常读环境变量，例如 `os.environ.get("AZURE_SPEECH_KEY")`。
不要硬编码密钥，不要直接读取 `~/.secrets/` 下的文件，不要建议改回全局 export。

**执行命令时**：你的 Bash 是非交互 shell，**direnv 不会自动生效**。
需要密钥的命令必须二选一：

```bash
direnv exec . <命令>              # 单条命令
eval "$(direnv export bash)"     # 或本次会话开头执行一次
```

**验证是否加载**：`echo ${#AZURE_SPEECH_KEY}` —— 只打印长度。

**绝不要** `echo $AZURE_SPEECH_KEY` 或 `env | grep KEY`。
密钥会被写进会话日志：本机 2026-08 就因此在 18 个文件里留下了明文副本，
4 个 key 全部被迫轮换。
