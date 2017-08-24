1. Prepare a common.yaml config file using common.yaml.sample template
2. Prepare a backup/sync yaml config file (ex: config1.yaml) using config.yaml.sample as template
3. Set up your borg repository and add it to your config file (passphrase if needed)
4. Set up your rclone config and add it to your config file
5. Backup with ```$ ./run/backup config1```
6. Syncronize with ```$ ./run/synchronize config1```

Example cron
```
# 1. minute (0-59) 
# |   2. hour (0-23) 
# |   |   3. day of month (1-31) 
# |   |   |   4. month (1-12) 
# |   |   |   |   5. day of week (0-7: 0 or 7 is Sun, or use names) 
# |   |   |   |   |   6. commandline 
# |   |   |   |   |   | 
#min hr  dom mon dow command 
00   04  *   *   *   { ~/bin/backup min && ~/bin/synchronize min; } > /tmp/min.log || ~/bin/mail-notify "Failed backup" /tmp/min.log
```

TODO:
- Automatic cron configurationi & easy logging/reporting
- User notification on backup or synchronize fail
- Add locking on borg server to block concurrent backup & synchronize
- Merge with torautomator?

