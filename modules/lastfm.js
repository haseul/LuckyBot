const Discord = require("discord.js");
const axios = require("axios");
const Lastfm = require("./lastfm_data.js");
const lastfm = new Lastfm();
const MAX_CHAR = 2048;
const commands = {
	//Retrieve data
	"nowPlaying": ["np", "nowplaying", "now-playing"],
	"topTracks": ["tt", "toptrack", "toptracks", "top-track", "top-tracks"],
	"topArtists": ["ta", "topartist", "topartists", "top-artist", "top-artists"],
	"topAlbums": ["talb", "tal", "topalbum", "topalbums", "top-album", "top-albums"],
	"recentTracks": ["recent", "recenttracks", "recent-tracks"],
	//Settings
	"setLayout": ["layout", "lo"],
	"saveUsername": ["set", "save"],
	//Time periods
	"weekly": ["week", "7-day", "7day", "weekly"],
	"monthly": ["month", "1-month", "1month", "monthly"],
	"threeMonth": ["3-month", "3month"],
	"sixMonth": ["half-year", "6-month", "6month", "halfyear"],
	"yearly": ["year", "12-month", "12month", "yearly"]
};
let notRegisteredAlert;
let apiKey;

module.exports = (bot = Discord.Client) => {

	require("./../functions/helpfunctions.js")(bot);

	lastFM = function lastFM(message) {
		if (message.system || message.author.bot || message.channel.type === 'dm') return;

		const serverSettings = bot.getServerSettings(message.guild.id);
		if (!serverSettings) return;
		let prefix = serverSettings.prefix;
		apiKey = bot.botSettings.lastfm;

		let messageArray = message.content.split(" ");
		let command = messageArray[0];
		let args = messageArray.slice(1);

		if (![`${prefix}lastfm`, `${prefix}lf`].includes(command)) return;

		notRegisteredAlert = `Please register your last.fm by using ${prefix}lf set <username>`;

		//Get the user to request last.fm data for, if needed,
		//then removes any mentions from the args list
		let target = getTarget(message, args);

		if (args.length === 0) {
			attemptToRetrieveUserInfo(message, target);
			return;
		}

		switch (true) {

			//Save username	
			case (commands.saveUsername.includes(args[0])):
				if (args.length === 1) {
					message.reply(`No username supplied.`);
					return;
				}
				attemptToSaveLastfmUsername(message, args[1]);
				break;

			//Set layout
			case (commands.setLayout.includes(args[0])):
				if (args.length === 1) {
					message.reply(`Please select a layout between 0 and 5.`);
					return;
				}
				attemptToSetLayout(args[1], message);
				break;

			//Now Playing	
			case (commands.nowPlaying.includes(args[0])):
				attemptToRetrieveNowPlaying(target, message);
				break;

			//Recent
			case (commands.recentTracks.includes(args[0])):
				attemptToRetrieveRecentTracks(target, message);
				break;

			//Top Tracks
			case (commands.topTracks.includes(args[0])):
				attemptToRetrieveTopTracks(target, getTimePeriod(args.slice(-1)[0]), message);
				break;

			//Top Artist	
			case (commands.topArtists.includes(args[0])):
				attemptToRetrieveTopArtists(target, getTimePeriod(args.slice(-1)[0]), message);
				break;

			//Top Album
			case (commands.topAlbums.includes(args[0])):
				attemptToRetrieveTopAlbums(target, getTimePeriod(args.slice(-1)[0]), message);
				break;

			//Help
			default:
				sendLastfmHelpEmbed(message, prefix);
				return;
		}
	};
};

//Gets the first memtion from the command, if any, and removes all mentions from the list of args
function attemptToGetMentionId(args) {
	let mentions = [];

	for (let i = args.length - 1; i >= 0; i--) {
		const element = args[i];
		if (isMention(element)) {
			//Return 18-digit user id and remove it from the list of arguments
			mentions.push(element.replace("<@", "").replace(">", ""));
			args.splice(i, 1);
		}
	}

	return mentions[0];
}

function attemptToRetrieveNowPlaying(target, message) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `http://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${username}&limit=2&api_key=${apiKey}&extended=1&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) return Promise.reject(response);
					if (!response.data.recenttracks) {
						console.log(`No Recent`);
						return;
					}
					if (!response.data.recenttracks.track[0]) {
						console.log(`No Track`);
						message.channel.send("Could not find any tracks.");
						return;
					}
					displayNowPlaying(response.data.recenttracks, message, target.user.displayAvatarURL, username);
					return;
				}).catch((error) => {
					handleError(message, error);
				});
			} else {
				message.channel.send(notRegisteredAlert);
				return;
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToRetrieveRecentTracks(target, message) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `http://ws.audioscrobbler.com/2.0/?method=user.getRecentTracks&user=${username}&api_key=${apiKey}&limit=10&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) {
						return Promise.reject(response);
					}
					if (!response.data.recenttracks) {
						console.log(`No Recent`);
						return;
					}
					if (!response.data.recenttracks.track[0]) {
						console.log(`No Track`);
						message.channel.send("Could not find any tracks.");
						return;
					}
					let embed = new Discord.RichEmbed()
						.setAuthor(`${username}'s Recent Tracks`, target.user.displayAvatarURL.split("?")[0]);
					displayRecentTracks(message, embed, response.data.recenttracks.track);
				}).catch((error) => {
					handleError(message, error);
				});
			}
			else {
				message.channel.send(notRegisteredAlert);
				return;
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToRetrieveTopAlbums(target, time, message) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=${username}&api_key=${apiKey}&period=${time.period}&limit=10&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) {
						return Promise.reject(response);
					}
					let embed = new Discord.RichEmbed()
						.setAuthor(`${username}'s ${time.name} Top Albums`, target.user.displayAvatarURL.split("?")[0]);
					displayTopAlbums(message, embed, response.data.topalbums.album);
				}).catch((error) => {
					handleError(message, error);
				});
			}
			else {
				message.channel.send(notRegisteredAlert);
				return;
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToRetrieveTopArtists(target, time, message) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${apiKey}&period=${time.period}&limit=10&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) {
						return Promise.reject(response);
					}
					let embed = new Discord.RichEmbed()
						.setAuthor(`${username}'s ${time.name} Top Artists`, target.user.displayAvatarURL.split("?")[0]);
					displayTopArtists(message, embed, response.data.topartists.artist);
				}).catch((error) => {
					handleError(message, error);
				});
			}
			else {
				message.channel.send(notRegisteredAlert);
				return;
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToRetrieveTopTracks(target, time, message) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=${username}&api_key=${apiKey}&period=${time.period}&limit=10&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) {
						return Promise.reject(response);
					}
					if (!response.data.toptracks) {
						console.log(`No Toptrack`);
						return;
					}
					let embed = new Discord.RichEmbed()
						.setAuthor(`${username}'s ${time.name} Top Tracks`, target.user.displayAvatarURL.split("?")[0]);
					displayTopTracks(message, embed, response.data.toptracks.track);
				}).catch((error) => {
					handleError(message, error);
				});
			}
			else {
				message.channel.send(notRegisteredAlert);
				return;
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToRetrieveUserInfo(message, target) {
	lastfm.getLastfmData(target.id)
		.then((data) => {
			if (data.username !== null) {
				let username = data.username;
				let url = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${apiKey}&format=json`;
				axios.get(url).then(response => {
					if (response.data.error) {
						return Promise.reject(response);
					}
					if (!response.data.user) {
						console.log(`Blank Account`);
						return;
					}
					let thumbnailURL = "";
					if (!response.data.user.image) {
						console.log(`No image found`);
					}
					else {
						response.data.user.image.forEach(image => {
							if (image["size"] === "extralarge") {
								thumbnailURL = image["#text"];
							}
						});
					}
					let date = new Date(response.data.user.registered.unixtime * 1000);
					let embed = new Discord.RichEmbed()
						.setAuthor(target.user.tag, target.user.displayAvatarURL.split("?")[0])
						.setURL(response.data.user.url)
						.setThumbnail(thumbnailURL)
						.setColor("#33cc33")
						.addField("Registered", `${date.getFullYear(date)}/${date.getMonth(date) + 1}/${date.getDate(date)}`, true)
						.addField("Scrobbles", response.data.user.playcount, true)
						.addField("Profile", `Click [here](${response.data.user.url}) to see their profile`, true)
						.addField("Country", response.data.user.country, true)
						.setFooter("Powered by last.fm", "https://i.imgur.com/C7u8gqg.jpg");
					sendEmbed(message, embed);
					return;
				}).catch((error) => {
					handleError(message, error);
				});
			}
			else {
				message.channel.send(notRegisteredAlert);
			}
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToSaveLastfmUsername(message, username) {
	lastfm.getLastfmData(message.author.id)
		.then(() => {
			let url = `https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${username}&api_key=${apiKey}&format=json`;
			axios.get(url).then(response => {
				if (response.data.error) {
					return Promise.reject(response.data.message);
				}
				lastfm.setProfile(message.author.id, username, null);
				message.reply(`Username saved as: ${username}`);
				return;
			}).catch((error) => {
				handleError(message, error);
			});
		}).catch((error) => {
			console.log(error);
		});
}

function attemptToSetLayout(layout, message) {
	lastfm.getLastfmData(message.author.id)
		.then(() => {
			lastfm.setLayout(message.author.id, layout);
			message.reply(`Layout format set as: ${layout}`);
		}).catch((error) => {
			console.log(error);
		});
}

function displayNowPlaying(recentTracks, message, displayAvatarURL, username) {
	let track1 = recentTracks.track[0];
	let track2 = recentTracks.track[1];
	let album = track1.album["#text"] ? track1.album["#text"] : "N/A";

	try {
		let embed = new Discord.RichEmbed()
			.setColor("#33cc33")
			.setTimestamp(message.createdAt)
			.setFooter("Powered by last.fm", "https://i.imgur.com/C7u8gqg.jpg");

			setThumbnail(embed, track1);

		if (isNowPlaying(track1)) {
			embed.setAuthor(`${username} - Now Playing${track1.loved === '1' ? " ❤️" : ""}`, displayAvatarURL.split("?")[0])
				.addField("Song", `[${track1.name}](${formatUrl(track1.url)})`, true)
				.addField("Artist", track1.artist.name, true)
				.addField("Album", album)
				.addField("Previous Song", `[${track2.name}](${formatUrl(track2.url)})`, true)
				.addField("Previous Artist", track2.artist.name, true);
		} else {
			embed.setAuthor(`${username} - No Current Song`, displayAvatarURL.split("?")[0])
				.addField("Previous Song", `[${track1.name}](${formatUrl(track1.url)})`, true)
				.addField("Previous Artist", track1.artist.name, true)
				.addField("Previous Album", album);
		}
		sendEmbed(message, embed);
	} catch (e) {
		console.log(e);
	}

}

function displayRecentTracks(message, embed, tracks) {
	for (i = 0; i < tracks.length; i++) {
		if (!tracks[i]) {
			console.log(`No Track`);
			return;
		}
	}
	let msg = "";
	if (isNowPlaying(tracks[0])) {
		let nowPlaying = tracks.splice(0, 1)[0];
		msg += `Now Playing: [${nowPlaying.artist["#text"]}](https://www.last.fm/music/${formatUrl(nowPlaying.artist["#text"].replace(/ /g, "+"))}) `;
		msg += `- [${nowPlaying.name}](${formatUrl(nowPlaying.url)})\n\n`;
	}
	for (i = 0; i < tracks.length; i++) {
		msg += `${i + 1}. [${tracks[i].artist["#text"]}](https://www.last.fm/music/${formatUrl(tracks[i].artist["#text"].replace(/ /g, "+"))}) `;
		msg += `- [${tracks[i].name}](${formatUrl(tracks[i].url)})\n`;
	}
	embedCss(message, embed, msg);
}

function displayTopAlbums(message, embed, albums) {
	for (i = 0; i < albums.length; i++) {
		if (!albums[i]) {
			console.log(`No Album`);
			return;
		}
	}
	let msg = "";
	for (i = 0; i < albums.length; i++) {
		msg += `${i + 1}. [${albums[i].artist.name}](${formatUrl(albums[i].artist.url)}) `;
		msg += `- [${albums[i].name}](${formatUrl(albums[i].url)}) (${albums[i].playcount} plays)\n`;
	}
	setThumbnail(embed, albums[0]);
	embedCss(message, embed, msg);
}

function displayTopArtists(message, embed, artists) {
	for (i = 0; i < artists.length; i++) {
		if (!artists[i]) {
			console.log(`No Artist`);
			return;
		}
	}
	let msg = "";
	for (i = 0; i < artists.length; i++) {
		msg += `${i + 1}. [${artists[i].name}](${formatUrl(artists[i].url)}) (${artists[i].playcount} plays)\n`;
	}
	setThumbnail(embed, artists[0]);
	embedCss(message, embed, msg);
}

function displayTopTracks(message, embed, tracks) {
	for (i = 0; i < tracks.length; i++) {
		if (!tracks[i]) {
			console.log(`No Track`);
			return;
		}
	}
	let msg = "";
	for (i = 0; i < tracks.length; i++) {
		msg += `${i + 1}. [${tracks[i].artist.name}](${formatUrl(tracks[i].artist.url)}) - [${tracks[i].name}](${formatUrl(tracks[i].url)}) (${tracks[i].playcount} plays)\n`;
	}
	setThumbnail(embed, tracks[0]);
	embedCss(message, embed, msg);
}

//Embed colors, message, and footer function
function embedCss(message, embed, msg) {
	embed.setColor("#33cc33");
	embed.setDescription(msg.substring(0, MAX_CHAR));
	embed.setFooter("Powered by last.fm", "https://i.imgur.com/C7u8gqg.jpg");
	sendEmbed(message, embed);
}

function formatUrl(url) {
	return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function setThumbnail(embed, object) {
	if (!object.image) {
		console.log(`No Image`);
	}
	object.image.forEach(image => {
		if (image["size"] === "extralarge") {
			embed.setThumbnail(image["#text"]);
		}
	});
}

//Function which determines which user to get last.fm data for
function getTarget(message, args) {
	let mentionId = attemptToGetMentionId(args);

	if (mentionId && message.guild.members.has(mentionId)) {
		return message.guild.member(mentionId);
	}

	return message.member;
}

//Function for parsing user input into time period
function getTimePeriod(arg) {
	switch (true) {
		case (commands.weekly.includes(arg)):
			return { "period": "7day", "name": "Weekly" };
		case (commands.monthly.includes(arg)):
			return { "period": "1month", "name": "Monthly" };
		case (commands.threeMonth.includes(arg)):
			return { "period": "3month", "name": "3 Month" };
		case (commands.sixMonth.includes(arg)):
			return { "period": "6month", "name": "6 Month" };
		case (commands.yearly.includes(arg)):
			return { "period": "12month", "name": "Yearly" };
		default:
			return { "period": "overall", "name": "All Time" };
	}
}

function handleError(message, error) {
	if (error.response) {
		message.reply(`Error ${error.response.status}: ${error.response.data.message}`);
		console.log(error.response.status, error.response.data.message);
		return;
	}
	else if (error.status) {
		message.reply(`Error ${error.status}: ${error.data.message}`);
		console.log(error.status, error.data.message);
		return;
	}
}

//returns whether an argument contains @user or a 18-char numberic user ID
function isMention(argument) {
	return argument.includes("<@") || (!isNaN(argument) && argument.length == 18);
}

function isNowPlaying(track) {
	return track["@attr"];
}

function sendLastfmHelpEmbed(message, prefix) {
	let embed = new Discord.RichEmbed();
	lastFMHelp(prefix, embed);
	sendEmbed(message, embed);
}