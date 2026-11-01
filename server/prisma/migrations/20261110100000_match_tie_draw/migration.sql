-- Match de groupe : gagnant tiré au sort parmi des ex aequo
ALTER TABLE "MatchPoll" ADD COLUMN "tieDraw" BOOLEAN NOT NULL DEFAULT false;
