#include "ArrowCore.hpp"
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#define REQUIRE(x) do { if(!(x)) { std::cerr << "FAIL line " << __LINE__ << ": " #x "\n"; return EXIT_FAILURE; } } while(0)
int main() {
 using namespace gogo::arrowout;
 Board b{5,4,{{{{0,1},{1,1}},1,0,true},{{{3,1},{4,1}},1,1,true}}};
 auto occ=occupancy(b);
 REQUIRE(pieceBlocker(b,occ,0)==1);
 REQUIRE(!removePiece(b,0));
 REQUIRE(removePiece(b,1));
 occ=occupancy(b);
 REQUIRE(pieceBlocker(b,occ,0)==-1);
 REQUIRE(removePiece(b,0));

 // A blocker aligned with a winding BODY cell, but not the HEAD exit ray,
 // must not prevent this arrow from leaving.
 Board body{4,4,{{{{0,2},{1,2},{1,1},{2,1}},1,0,true},{{{3,2},{3,3}},2,1,true}}};
 auto o2=occupancy(body);
 REQUIRE(pieceBlocker(body,o2,0)==-1);

 // Invalid/stale occupancy must never index outside the piece vector.
 auto corrupt=o2;
 corrupt[0]=999;
 REQUIRE(pieceBlocker(body,corrupt,0)==-2);
 corrupt=o2;
 corrupt[0]=-2;
 REQUIRE(pieceBlocker(body,corrupt,0)==-2);

 // Invalid path loops, one-cell paths, and direction mismatches are rejected.
 Board loop{4,4,{{{{0,0},{1,0},{1,1},{0,0}},1,0,true}}};
 REQUIRE(!valid(loop));
 Board oneCell{4,4,{{{{0,0}},1,0,true}}};
 REQUIRE(!valid(oneCell));
 Board wrongDirection{4,4,{{{{0,0},{1,0}},0,0,true}}};
 REQUIRE(!valid(wrongDirection));

 Board overlap{4,4,{{{{0,1},{1,1}},1,0,true},{{{0,1},{0,2}},2,1,true}}};
 bool rejected=false;
 try { (void)occupancy(overlap); } catch(const std::invalid_argument&) { rejected=true; }
 REQUIRE(rejected);

 Board dead{4,4,{{{{0,0},{1,0}},1,0,false}}};
 auto deadOcc=occupancy(dead);
 REQUIRE(pieceBlocker(dead,deadOcc,0)==-2);
 return EXIT_SUCCESS;
}
