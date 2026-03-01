import { Client, GatewayIntentBits, ChannelType, PermissionsBitField } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
dotenv.config();

// --- 設定 ---
const ENTRY_CHANNEL_ID = '1477473413722280008'; // 入り口のボイスチャンネルID
const ALLOWED_ROLE_ID = '1477292757985919198';   // 入室・閲覧可能なロールID

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('ready', () => console.log('✅ プライベートルームBotが起動しました！'));

client.on('voiceStateUpdate', async (oldState, newState) => {
    const guild = newState.guild;

    // --- 1. 入室処理 ---
    if (newState.channelId === ENTRY_CHANNEL_ID) {
        const member = newState.member;
        const roomName = `${member.displayName}'s Room`;

        // カテゴリー作成（権限設定付き）
        const category = await guild.channels.create({
            name: roomName,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }, // 全員閲覧禁止
                { id: ALLOWED_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }, // ロール保持者許可
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] } // Bot自身
            ]
        });

        // ボイスチャンネル作成
        const vChannel = await guild.channels.create({
            name: roomName,
            type: ChannelType.GuildVoice,
            parent: category,
        });

        // テキストチャンネル作成
        await guild.channels.create({
            name: `${member.displayName}-聞き専`,
            type: ChannelType.GuildText,
            parent: category,
        });

        // 作成したボイスチャンネルへ移動
        await member.voice.setChannel(vChannel).catch(console.error);
    }

    // --- 2. 退室・掃除処理 ---
    if (oldState.channel && oldState.channel.id !== ENTRY_CHANNEL_ID && oldState.channel.parent?.permissionOverwrites.resolve(ALLOWED_ROLE_ID)) {
        const category = oldState.channel.parent;
        
        // チャンネル内に誰もいなくなったら削除
        if (oldState.channel.members.size === 0) {
            for (const [id, ch] of category.children.cache) {
                await ch.delete().catch(console.error);
            }
            await category.delete().catch(console.error);
            console.log(`🧹 ${category.name} を削除しました`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
const app = express();
app.listen(process.env.PORT || 4000);