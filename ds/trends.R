library(tidyverse)
library(anytime)

people <- read_csv('f22-people.csv')
msg <- read_csv('f22-messages.csv', col_types = list(channel = col_character()))

messages <- left_join(msg, people, by=c("author" = "id")) %>%
  select(username, channel, time, length) %>%
  filter(time > 1e10) %>%
  mutate(channel = as.character(channel),
         time = anytime(time/1000))

top_channels <- names(rev(sort(table(messages$channel)))[1:20])

top_users <- names(rev(sort(table(messages$username)))[1:20])

messages %>% filter(channel %in% top_channels) %>% ggplot(aes(x=time)) +
  geom_histogram() + facet_wrap(~channel)

messages %>% filter(username %in% top_users) %>% ggplot(aes(x=time)) +
  geom_histogram() + facet_wrap(~username) + theme_bw() + labs(title='Activity over time for the top 20 participants')
