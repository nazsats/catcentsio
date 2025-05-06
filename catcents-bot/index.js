// index.js
require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, Colors } = require('discord.js');
const admin = require('firebase-admin');

// Log the Discord token to verify it's loaded
console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN || 'Undefined');

// Initialize Firebase Admin using JSON file
admin.initializeApp({
  credential: admin.credential.cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH),
});
const db = admin.firestore();

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// Badge milestones and their corresponding role names (from components/Badges.tsx)
const badgeMilestones = [
  { milestone: 500, name: 'Whisker Initiate' },
  { milestone: 1000, name: 'Pawthfinder' },
  { milestone: 2000, name: 'Claw Collector' },
  { milestone: 5000, name: 'Yarnmaster' },
  { milestone: 10000, name: 'Alley Alpha' },
  { milestone: 50000, name: 'Shadow Stalker' },
  { milestone: 100000, name: 'Furion Elite' },
  { milestone: 500000, name: 'Mythic Pouncer' },
  { milestone: 1000000, name: 'Catcents Legend' },
];

// When the bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await syncAllUsers();
  // Sync every hour
  setInterval(syncAllUsers, 60 * 60 * 1000);
});

// Sync all users' roles
async function syncAllUsers() {
  console.log('Syncing roles for all users...');
  try {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const discordUsername = userData.discordUsername;
      const claimedBadges = userData.claimedBadges || [];

      if (!discordUsername) {
        console.log(`No Discord username for user ${userDoc.id}`);
        continue;
      }

      let discordMember = null;
      for (const guild of client.guilds.cache.values()) {
        try {
          const members = await guild.members.fetch();
          discordMember = members.find(
            (m) => m.user.username === discordUsername || m.user.tag === discordUsername
          );
          if (discordMember) break;
        } catch (error) {
          console.error(`Error fetching members in guild ${guild.id}:`, error);
        }
      }

      if (!discordMember) {
        console.log(`User ${discordUsername} not found in any guild`);
        continue;
      }

      await syncUserRoles(discordMember, claimedBadges);
    }
    console.log('Role sync completed.');
  } catch (error) {
    console.error('Error syncing users:', error);
  }
}

// Sync roles for a single user
async function syncUserRoles(member, claimedBadges) {
  try {
    const guild = member.guild;
    const rolesToAdd = [];
    const rolesToRemove = [];

    // Map claimed badge milestones to role names
    const claimedRoleNames = claimedBadges
      .map((milestone) => {
        const badge = badgeMilestones.find((b) => b.milestone === milestone);
        return badge ? badge.name : null;
      })
      .filter((name) => name);

    // Get all badge roles in the guild
    let badgeRoles = guild.roles.cache.filter((role) =>
      badgeMilestones.some((badge) => badge.name === role.name)
    );

    // Create roles if they don't exist
    for (const badge of badgeMilestones) {
      let role = badgeRoles.find((r) => r.name === badge.name);
      if (!role) {
        try {
          role = await guild.roles.create({
            name: badge.name,
            color: Colors.Purple, // Use Discord.js Colors.Purple
            reason: 'Created for Catcents badge system',
            permissions: [],
          });
          console.log(`Created role ${badge.name} in guild ${guild.name}`);
        } catch (error) {
          console.error(`Failed to create role ${badge.name}:`, error);
          continue;
        }
      }

      if (claimedRoleNames.includes(badge.name)) {
        if (!member.roles.cache.has(role.id)) {
          rolesToAdd.push(role);
        }
      } else {
        if (member.roles.cache.has(role.id)) {
          rolesToRemove.push(role);
        }
      }
    }

    // Apply role changes
    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd);
      console.log(`Added roles to ${member.user.tag}: ${rolesToAdd.map((r) => r.name).join(', ')}`);
    }

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove);
      console.log(`Removed roles from ${member.user.tag}: ${rolesToRemove.map((r) => r.name).join(', ')}`);
    }

    if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
      console.log(`No role changes needed for ${member.user.tag}`);
    }
  } catch (error) {
    console.error(`Error syncing roles for ${member.user.tag}:`, error);
  }
}

// Slash command to manually trigger role sync
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'syncroles') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await interaction.reply({
        content: 'You need Manage Roles permission to use this command.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    await syncAllUsers();
    await interaction.editReply('Role sync completed for all users.');
  }
});

// Register slash command
client.on('ready', async () => {
  try {
    await client.application.commands.create({
      name: 'syncroles',
      description: 'Manually sync roles for all users based on Firebase badges',
    });
    console.log('Registered /syncroles command');
  } catch (error) {
    console.error('Error registering slash command:', error);
  }
});

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN);