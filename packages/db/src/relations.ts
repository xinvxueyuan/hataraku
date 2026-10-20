import { defineRelations } from "drizzle-orm";

import { loginAttempts } from "#src/schema/audit.ts";
import { account, session, user, verification } from "#src/schema/auth.ts";
import {
  changelogEntries,
  friends,
  microPosts,
  projects,
  skills,
  tools,
} from "#src/schema/content.ts";
import { albumPhotos, albums, devices } from "#src/schema/media.ts";
import {
  diaryEntries,
  siteProfile,
  timelineEntries,
} from "#src/schema/pages.ts";
import { posts } from "#src/schema/posts.ts";
import { searchIndex } from "#src/schema/search.ts";
import { categories, postTags, tags } from "#src/schema/taxonomy.ts";
import { todos } from "#src/schema/todos.ts";

export const relations = defineRelations(
  {
    account,
    albumPhotos,
    albums,
    categories,
    changelogEntries,
    devices,
    diaryEntries,
    friends,
    loginAttempts,
    microPosts,
    postTags,
    posts,
    projects,
    searchIndex,
    session,
    siteProfile,
    skills,
    tags,
    timelineEntries,
    todos,
    tools,
    user,
    verification,
  },
  (r) => ({
    account: {
      user: r.one.user({ from: r.account.userId, to: r.user.id }),
    },
    albumPhotos: {
      album: r.one.albums({ from: r.albumPhotos.albumId, to: r.albums.id }),
    },
    albums: {
      photos: r.many.albumPhotos(),
    },
    categories: {
      posts: r.many.posts(),
    },
    postTags: {
      post: r.one.posts({ from: r.postTags.postId, to: r.posts.id }),
      tag: r.one.tags({ from: r.postTags.tagId, to: r.tags.id }),
    },
    posts: {
      category: r.one.categories({
        from: r.posts.categoryId,
        to: r.categories.id,
      }),
      postTags: r.many.postTags(),
      searchIndex: r.one.searchIndex({
        from: r.posts.id,
        to: r.searchIndex.postId,
      }),
    },
    searchIndex: {
      post: r.one.posts({ from: r.searchIndex.postId, to: r.posts.id }),
    },
    session: {
      user: r.one.user({ from: r.session.userId, to: r.user.id }),
    },
    tags: {
      postTags: r.many.postTags(),
    },
    todos: {
      user: r.one.user({ from: r.todos.userId, to: r.user.id }),
    },
    user: {
      accounts: r.many.account(),
      sessions: r.many.session(),
      todos: r.many.todos(),
    },
  })
);
